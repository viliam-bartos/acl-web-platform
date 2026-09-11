import math
import numpy as np
from typing import Dict, Any


def extract_radiomic_features(
    mask: np.ndarray,
    spacing: tuple,
    months_post_op: float
) -> Dict[str, Any]:
    """
    Mock Radiomic & Morphometric Feature Extraction.
    Extracts geometric, volumetric, and texture metrics representing ligamentization.
    
    Args:
        mask: 3D binary voxel mask
        spacing: voxel spacing in mm (sz, sy, sx)
        months_post_op: Time elapsed since surgery in months
    """
    voxel_volume_mm3 = float(spacing[0] * spacing[1] * spacing[2])
    voxel_count = int(np.sum(mask > 0))

    # Base volume with subtle patient variation
    base_volume_mm3 = voxel_count * voxel_volume_mm3
    # Realistic ACL graft volume is between 2000 - 3100 mm3
    volume_mm3 = round(base_volume_mm3 * 0.45 + 1800.0 + (months_post_op * 35.0), 1)

    # Remodeling curve (Maturation / Ligamentization index):
    # During initial 6 weeks (1-2 mo): necrotic phase, lower integrity (~50-60%)
    # 3-6 months: proliferative/revascularization phase (~65-80%)
    # 12-24 months: maturation/remodeling phase (85-95%)
    # Sigmoidal remodeling response:
    t = max(0.5, float(months_post_op))
    maturation_factor = 1.0 / (1.0 + math.exp(-0.35 * (t - 4.5)))
    integrity_score = round(48.0 + 47.0 * maturation_factor + np.random.uniform(-1.5, 1.5), 1)
    integrity_score = min(98.0, max(40.0, integrity_score))

    # Geometric metrics
    estimated_length_mm = round(34.5 + np.random.uniform(-1.2, 1.2), 1)
    mean_cross_section_mm2 = round(volume_mm3 / estimated_length_mm, 1)

    # Radiomic texture descriptors (PyRadiomics GLCM/GLRLM mocks)
    snr_ratio = round(14.2 + (months_post_op * 0.45) + np.random.uniform(-0.5, 0.5), 2)
    glcm_homogeneity = round(0.42 + (0.35 * maturation_factor), 3)
    glcm_contrast = round(18.4 - (6.2 * maturation_factor), 2)
    sphericity = 0.385  # Elongated tubular anatomical structure

    return {
        "volume_mm3": volume_mm3,
        "integrity_score": integrity_score,
        "estimated_length_mm": estimated_length_mm,
        "mean_cross_section_mm2": mean_cross_section_mm2,
        "snr_ratio": snr_ratio,
        "glcm_homogeneity": glcm_homogeneity,
        "glcm_contrast": glcm_contrast,
        "sphericity": sphericity,
        "remodeling_stage": _get_remodeling_stage(months_post_op)
    }


def _get_remodeling_stage(months: float) -> str:
    if months < 2.0:
        return "Early Necrosis & Hypovascularity (Stage 1)"
    elif months < 6.0:
        return "Proliferation & Revascularization (Stage 2)"
    elif months < 12.0:
        return "Ligamentization Maturation (Stage 3)"
    else:
        return "Remodeled Mature Graft (Stage 4)"
