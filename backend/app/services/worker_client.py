"""
Klient výpočetního workera.

Tato aplikace je tenká: neumí segmentovat, měřit ani renderovat. Veškerý výpočet
dělá worker na výkonném počítači (viz `Source/worker` v repu `ACL_graft_analysis`)
a tato vrstva je vůči němu jen klient přes HTTP.

Proč to tak je: dřív si backend půjčoval kód diplomky přes
`sys.path.insert(r"C:\\ACL_analysis\\ACL_graft_analysis\\Source")` a metriky, které
se mu nehodily, si dopočítával sám (`np.random.uniform`). Tím vznikala druhá
pravda o tom, co pacient má, a ta se s tou první rozešla. Rozhraní je proto
jediné: HTTP.
"""

from __future__ import annotations

import logging
import os
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)

TERMINAL_STATUSES = frozenset({"succeeded", "failed"})


class ComputeWorkerError(RuntimeError):
    """Selhání komunikace s výpočetním workerem."""


class ComputeWorkerTimeout(ComputeWorkerError):
    """Worker úlohu nedokončil v časovém limitu."""


@dataclass(frozen=True)
class WorkerConfig:
    """Adresa a chování výpočetního workera."""

    base_url: str
    token: str | None = None
    wait_s: float = 900.0
    poll_s: float = 1.0
    request_timeout_s: float = 60.0

    @classmethod
    def from_env(cls) -> WorkerConfig:
        base = (os.environ.get("COMPUTE_WORKER_URL") or "").strip().rstrip("/")
        return cls(
            base_url=base or "http://127.0.0.1:8100",
            token=(os.environ.get("COMPUTE_WORKER_TOKEN") or "").strip() or None,
            wait_s=float(os.environ.get("COMPUTE_WORKER_WAIT_S", "900")),
            poll_s=float(os.environ.get("COMPUTE_WORKER_POLL_S", "1.0")),
            request_timeout_s=float(os.environ.get("COMPUTE_WORKER_REQUEST_TIMEOUT_S", "60")),
        )

    @property
    def headers(self) -> dict[str, str]:
        return {"X-API-Token": self.token} if self.token else {}

    def url(self, path: str) -> str:
        return f"{self.base_url}{path}"


def _connection_hint(config: WorkerConfig) -> str:
    return (
        f"Výpočetní worker na {config.base_url} neodpovídá. "
        "Je spuštěný? (Source\\worker\\run_worker.bat v repu ACL_graft_analysis) "
        "Sedí COMPUTE_WORKER_URL?"
    )


def _to_bool_flag(value: bool) -> str:
    return "true" if value else "false"


def submit_scan(
    config: WorkerConfig,
    *,
    file_path: str,
    filename: str,
    patient_id: str,
    months_post_op: float,
    laterality: str | None = None,
    compute_radiomics: bool = True,
    run_inference: bool = True,
    input_is_mask: bool = False,
) -> str:
    """Předá objem workeru a vrátí ID úlohy.

    Soubor se čte z disku po částech, takže se celý objem nedrží v paměti
    tenké aplikace.
    """
    data: dict[str, str] = {
        "patient_id": patient_id,
        "months_post_op": str(months_post_op),
        "compute_radiomics": _to_bool_flag(compute_radiomics),
        "run_inference": _to_bool_flag(run_inference),
        "input_is_mask": _to_bool_flag(input_is_mask),
    }
    if laterality:
        data["laterality"] = laterality

    try:
        with open(file_path, "rb") as handle:
            files = {"file": (filename, handle, "application/octet-stream")}
            with httpx.Client(timeout=config.request_timeout_s) as client:
                response = client.post(
                    config.url("/api/v1/jobs"), data=data, files=files, headers=config.headers
                )
    except httpx.HTTPError as exc:
        raise ComputeWorkerError(f"{_connection_hint(config)} ({exc})") from exc

    return _job_id_from(response, "zařazení úlohy")


def submit_reference_scan(
    config: WorkerConfig,
    *,
    patient_id: str,
    months_post_op: float,
    use_inference: bool = False,
    compute_radiomics: bool = True,
) -> str:
    """Nechá worker zhodnotit jeho vestavěný referenční případ (074)."""
    data = {
        "patient_id": patient_id,
        "months_post_op": str(months_post_op),
        "use_inference": _to_bool_flag(use_inference),
        "compute_radiomics": _to_bool_flag(compute_radiomics),
    }
    try:
        with httpx.Client(timeout=config.request_timeout_s) as client:
            response = client.post(
                config.url("/api/v1/jobs/reference"), data=data, headers=config.headers
            )
    except httpx.HTTPError as exc:
        raise ComputeWorkerError(f"{_connection_hint(config)} ({exc})") from exc

    return _job_id_from(response, "zařazení referenční úlohy")


def _job_id_from(response: httpx.Response, action: str) -> str:
    if response.status_code >= 400:
        detail = _error_detail(response)
        raise ComputeWorkerError(f"Worker odmítl {action} ({response.status_code}): {detail}")
    try:
        payload = response.json()
    except ValueError as exc:
        raise ComputeWorkerError(f"Worker nevrátil platný JSON při {action}.") from exc
    job_id = payload.get("job_id")
    if not job_id:
        raise ComputeWorkerError(f"Worker nevrátil ID úlohy při {action}.")
    return str(job_id)


def _error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text[:300]
    if isinstance(payload, dict) and "detail" in payload:
        return str(payload["detail"])
    return str(payload)[:300]


def get_job(config: WorkerConfig, job_id: str) -> dict[str, Any]:
    """Vrátí aktuální stav úlohy."""
    try:
        with httpx.Client(timeout=config.request_timeout_s) as client:
            response = client.get(config.url(f"/api/v1/jobs/{job_id}"), headers=config.headers)
    except httpx.HTTPError as exc:
        raise ComputeWorkerError(f"{_connection_hint(config)} ({exc})") from exc

    if response.status_code >= 400:
        raise ComputeWorkerError(
            f"Stav úlohy {job_id} nelze načíst ({response.status_code}): {_error_detail(response)}"
        )
    return response.json()


def wait_for_job(
    config: WorkerConfig,
    job_id: str,
    on_progress: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    """Čeká na dokončení úlohy a vrátí její stav.

    Raises:
        ComputeWorkerTimeout: pokud se úloha nedokončí do `config.wait_s`.
        ComputeWorkerError: pokud úloha selže nebo worker přestane odpovídat.
    """
    deadline = time.monotonic() + config.wait_s
    while True:
        job = get_job(config, job_id)
        if on_progress is not None:
            on_progress(job)

        status = job.get("status")
        if status in TERMINAL_STATUSES:
            if status == "failed":
                raise ComputeWorkerError(
                    f"Výpočet úlohy {job_id} selhal: {job.get('error') or 'bez bližšího popisu'}"
                )
            return job

        if time.monotonic() >= deadline:
            raise ComputeWorkerTimeout(
                f"Úloha {job_id} se nedokončila do {config.wait_s:.0f} s "
                f"(stav: {status}, fáze: {job.get('stage')}). "
                "Zvyš COMPUTE_WORKER_WAIT_S, nebo se k výsledku vrať později."
            )
        time.sleep(config.poll_s)


def download_artifact(config: WorkerConfig, job_id: str, kind: str) -> bytes:
    """Stáhne artefakt úlohy (`model` nebo `mask`)."""
    if kind not in ("model", "mask"):
        raise ValueError(f"Neznámý artefakt: {kind!r}")
    url = config.url(f"/api/v1/jobs/{job_id}/{kind}")
    try:
        with httpx.Client(timeout=max(config.request_timeout_s, 120.0)) as client:
            response = client.get(url, headers=config.headers)
    except httpx.HTTPError as exc:
        raise ComputeWorkerError(
            f"Artefakt {kind} úlohy {job_id} se nepodařilo stáhnout ({exc})."
        ) from exc

    if response.status_code >= 400:
        raise ComputeWorkerError(
            f"Artefakt {kind} úlohy {job_id} není k dispozici ({response.status_code})."
        )
    return response.content


def health(config: WorkerConfig | None = None) -> dict[str, Any]:
    """Vrátí stav workera, nebo `{"reachable": False, ...}`.

    Nikdy nevyhazuje výjimku – používá se v `/api/v1/health` tenké aplikace,
    která musí odpovědět i tehdy, když worker neběží.

    Klíč `reachable` je vlastní této vrstvě; `status` v odpovědi patří workeru
    ("healthy"), a proto se nesmí přepisovat.
    """
    config = config or WorkerConfig.from_env()
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(config.url("/api/v1/health"), headers=config.headers)
        if response.status_code >= 400:
            return {"reachable": False, "detail": f"HTTP {response.status_code}"}
        return {"reachable": True, **response.json()}
    except httpx.HTTPError as exc:
        return {"reachable": False, "detail": str(exc)}
