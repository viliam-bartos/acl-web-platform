import json
import os
import struct
from typing import Any

import numpy as np

# Palette colors matching C:\ACL_analysis\ACL_graft_analysis\Source\anaknee\visualizator_analyzator.py
PALETTE = {
    "femur":        "#ffffff",     # bright white bone
    "tibia":        "#ffffff",     # bright white bone
    "acl":          "#eab308",     # matte yellow ACL graft
    "plateau":      "#38b6ff",     # technical cyan plateau plane
    "bh_ref":       "#38b6ff",     # cyan reference tube
    "bh_grid":      "#38b6ff",     # cyan Bernard-Hertel grid
    "footprints":   "#f97316",     # matte orange attachment footprints
    "acl_vector":   "#c084fc",     # soft purple
}

STATIC_MODELS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "static", "models")
)


def export_mesh_to_glb(
    vertices: np.ndarray,
    faces: np.ndarray,
    normals: np.ndarray | None = None,
    output_path: str = "",
    color: list | None = None
) -> str:
    """Export 3D triangular mesh to a standard binary glTF (.glb) file."""
    if color is None:
        color = [1.0, 0.55, 0.26, 1.0]
    vertices = np.ascontiguousarray(vertices, dtype=np.float32)
    faces = np.ascontiguousarray(faces, dtype=np.uint32)

    if normals is None or len(normals) != len(vertices):
        normals = np.zeros_like(vertices, dtype=np.float32)
        v0 = vertices[faces[:, 0]]
        v1 = vertices[faces[:, 1]]
        v2 = vertices[faces[:, 2]]
        face_normals = np.cross(v1 - v0, v2 - v0)
        norm = np.linalg.norm(face_normals, axis=1, keepdims=True)
        norm[norm == 0] = 1.0
        face_normals /= norm
        for i in range(3):
            np.add.at(normals, faces[:, i], face_normals)
        v_norm = np.linalg.norm(normals, axis=1, keepdims=True)
        v_norm[v_norm == 0] = 1.0
        normals /= v_norm

    normals = np.ascontiguousarray(normals, dtype=np.float32)

    v_min = vertices.min(axis=0).tolist()
    v_max = vertices.max(axis=0).tolist()
    i_min = [int(faces.min())]
    i_max = [int(faces.max())]

    pos_bytes = vertices.tobytes()
    norm_bytes = normals.tobytes()
    idx_bytes = faces.flatten().tobytes()

    def pad4(b: bytes, pad_char=b'\x00') -> bytes:
        remainder = len(b) % 4
        return b if remainder == 0 else b + (pad_char * (4 - remainder))

    pos_bytes_padded = pad4(pos_bytes)
    norm_bytes_padded = pad4(norm_bytes)
    idx_bytes_padded = pad4(idx_bytes)

    offset_pos = 0
    len_pos = len(pos_bytes)
    offset_norm = offset_pos + len(pos_bytes_padded)
    len_norm = len(norm_bytes)
    offset_idx = offset_norm + len(norm_bytes_padded)
    len_idx = len(idx_bytes)

    bin_data = pos_bytes_padded + norm_bytes_padded + idx_bytes_padded

    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "ACL Web Platform PyVista Mesh Engine"
        },
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "ACL_Graft_Mesh"}],
        "meshes": [
            {
                "name": "ACL_Graft",
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1},
                        "indices": 2,
                        "material": 0,
                        "mode": 4
                    }
                ]
            }
        ],
        "materials": [
            {
                "name": "Ligament_Mat",
                "pbrMetallicRoughness": {
                    "baseColorFactor": color,
                    "metallicFactor": 0.05,
                    "roughnessFactor": 0.42
                },
                "doubleSided": True
            }
        ],
        "buffers": [{"byteLength": len(bin_data)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": offset_pos, "byteLength": len_pos, "target": 34962},
            {"buffer": 0, "byteOffset": offset_norm, "byteLength": len_norm, "target": 34962},
            {"buffer": 0, "byteOffset": offset_idx, "byteLength": len_idx, "target": 34963}
        ],
        "accessors": [
            {"bufferView": 0, "byteOffset": 0, "componentType": 5126, "count": len(vertices), "type": "VEC3", "min": v_min, "max": v_max},
            {"bufferView": 1, "byteOffset": 0, "componentType": 5126, "count": len(normals), "type": "VEC3"},
            {"bufferView": 2, "byteOffset": 0, "componentType": 5125, "count": len(faces.flatten()), "type": "SCALAR", "min": i_min, "max": i_max}
        ]
    }

    json_str = json.dumps(gltf, separators=(',', ':'))
    json_bytes = json_str.encode('utf-8')
    json_bytes_padded = pad4(json_bytes, pad_char=b' ')
    total_length = 12 + 8 + len(json_bytes_padded) + 8 + len(bin_data)

    glb_header = struct.pack("<4sII", b"glTF", 2, total_length)
    chunk0_header = struct.pack("<I4s", len(json_bytes_padded), b"JSON")
    chunk1_header = struct.pack("<I4s", len(bin_data), b"BIN\x00")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(glb_header)
        f.write(chunk0_header)
        f.write(json_bytes_padded)
        f.write(chunk1_header)
        f.write(bin_data)

    return output_path


def generate_complete_knee_gltf(
    scan_id: str,
    mask_data: np.ndarray,
    spacing: tuple,
    vis_data: dict[str, Any] | None = None
) -> str:
    """
    Builds and exports the complete 3D knee joint scene:
      - ACL (Vivid orange)
      - Femur (Ivory bone, translucent)
      - Tibia (Beige bone, translucent)
      - Tibial Plateau Plane (Cyan translucent plane)
      - B&H Grid (Slate reference lines / tubes)
      - Reference Edge (Amber tube)
      - Blumensaat Line (Green tube)
      - Footprints (Coral red)
    Directly replicates visualizator_analyzator.py from C:\\ACL_analysis\\ACL_graft_analysis.
    """
    import pyvista as pv
    from scipy.ndimage import binary_dilation
    pv.global_theme.allow_empty_mesh = True

    filename = f"{scan_id}_full.gltf"
    out_file = os.path.join(STATIC_MODELS_DIR, filename)

    if os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
        return f"/static/models/{filename}"

    def _extract_mesh(bin_mask, spacing, smooth=True, decimate=0.0):
        if not np.any(bin_mask):
            return pv.PolyData()
        padded = np.pad(bin_mask, 1, mode='constant', constant_values=0)
        grid = pv.ImageData()
        grid.dimensions = padded.shape
        grid.spacing = spacing
        grid.point_data['values'] = padded.flatten(order='F')
        m = grid.contour([0.5])
        m.point_data.clear()
        if decimate > 0 and m.n_points > 0:
            m = m.decimate_pro(decimate)
            m.point_data.clear()
        if smooth and m.n_points > 0:
            m = m.smooth(n_iter=15, relaxation_factor=0.1)
            m.point_data.clear()
        return m

    # 1. Anatomical Meshes
    mesh_acl = _extract_mesh(mask_data == 1, spacing, smooth=True)
    mesh_femur = _extract_mesh(mask_data == 2, spacing, smooth=True, decimate=0.85)
    mesh_tibia = _extract_mesh(mask_data == 3, spacing, smooth=True, decimate=0.85)

    # 2. Tibial Plateau Plane
    if vis_data and "plateau_normal" in vis_data and vis_data["plateau_normal"] is not None:
        plateau_normal = np.asarray(vis_data["plateau_normal"], dtype=float)
        plateau_center = np.asarray(vis_data["plateau_center"], dtype=float)
    else:
        plateau_normal = np.array([0.05, 0.05, 1.0])
        plateau_center = np.mean(mesh_tibia.points, axis=0) if mesh_tibia.n_points > 0 else np.array([45, 55, 32])

    if np.linalg.norm(plateau_normal) > 0:
        plateau_normal /= np.linalg.norm(plateau_normal)

    temp_i = np.array([1.0, 0.0, 0.0])
    temp_i_proj = temp_i - np.dot(temp_i, plateau_normal) * plateau_normal
    i_dir = temp_i_proj / (np.linalg.norm(temp_i_proj) + 1e-12)
    j_dir = np.cross(plateau_normal, i_dir)
    j_dir /= (np.linalg.norm(j_dir) + 1e-12)

    base_plane = pv.Plane(center=(0, 0, 0), direction=(0, 0, 1), i_size=65, j_size=65)
    tm = np.eye(4)
    tm[0:3, 0] = i_dir
    tm[0:3, 1] = j_dir
    tm[0:3, 2] = plateau_normal
    tm[0:3, 3] = plateau_center
    plateau_plane = base_plane.transform(tm, inplace=False)
    plateau_plane.point_data.clear()

    # 3. B&H Grid tubes & lines
    bh_tubes = []
    bh_lines_data = vis_data.get("bh_grid_info", {}).get("lines", []) if vis_data else []
    for start_pt, end_pt in bh_lines_data:
        t = pv.Line(start_pt, end_pt).tube(radius=0.45)
        t.point_data.clear()
        bh_tubes.append(t)
    bh_merged = pv.merge(bh_tubes) if bh_tubes else pv.PolyData()
    bh_merged.point_data.clear()

    ref_edge = vis_data.get("bh_grid_info", {}).get("ref_edge") if vis_data else None
    if ref_edge:
        ref_tube = pv.Line(ref_edge[0], ref_edge[1]).tube(radius=0.75)
        ref_tube.point_data.clear()
    else:
        ref_tube = pv.PolyData()

    blum_line = vis_data.get("bh_grid_info", {}).get("blum_line") if vis_data else None
    if blum_line:
        blum_tube = pv.Line(blum_line[0], blum_line[1]).tube(radius=0.75)
        blum_tube.point_data.clear()
    else:
        blum_tube = pv.PolyData()

    # 4. Dilated footprints (attachment sites)
    dilated_acl = binary_dilation(mask_data == 1, iterations=2)
    fp_femur_mask = dilated_acl & (mask_data == 2)
    fp_tibia_mask = dilated_acl & (mask_data == 3)
    mesh_fp_femur = _extract_mesh(fp_femur_mask, spacing, smooth=False)
    mesh_fp_tibia = _extract_mesh(fp_tibia_mask, spacing, smooth=False)
    fp_list = [m for m in [mesh_fp_femur, mesh_fp_tibia] if m.n_points > 0]
    mesh_footprints = pv.merge(fp_list) if fp_list else pv.PolyData()
    mesh_footprints.point_data.clear()

    # 5. Transform all meshes to upright vertical anatomical orientation centered at joint:
    # - Translate center of tibial plateau to (0, 0, 0)
    # - Rotate -90° around X axis and 180° around Y axis:
    #   Superior (+Z) -> UP (+Y) [Femur at top, Tibia at bottom]
    #   Anterior (+Y) -> FRONT (+Z) [Anterior face directly faces camera]
    all_meshes = [mesh_femur, mesh_tibia, mesh_acl, plateau_plane, bh_merged, ref_tube, blum_tube]
    if mesh_footprints.n_points > 0:
        all_meshes.append(mesh_footprints)

    for m in all_meshes:
        if m.n_points > 0:
            m.translate(-plateau_center, inplace=True)
            m.rotate_x(-90, inplace=True)
            m.rotate_y(180, inplace=True)

    # 6. Assemble Plotter Scene
    plotter = pv.Plotter(off_screen=True)
    plotter.add_mesh(mesh_femur, color=PALETTE["femur"], opacity=0.35, smooth_shading=True)
    plotter.add_mesh(mesh_tibia, color=PALETTE["tibia"], opacity=0.35, smooth_shading=True)
    plotter.add_mesh(mesh_acl, color=PALETTE["acl"], opacity=0.95, smooth_shading=True)
    plotter.add_mesh(plateau_plane, color=PALETTE["plateau"], opacity=0.45)
    plotter.add_mesh(bh_merged, color=PALETTE["bh_grid"], opacity=0.85)
    plotter.add_mesh(ref_tube, color=PALETTE["bh_ref"], opacity=1.0)
    plotter.add_mesh(blum_tube, color=PALETTE["bh_ref"], opacity=1.0)
    if mesh_footprints.n_points > 0:
        plotter.add_mesh(mesh_footprints, color=PALETTE["footprints"], opacity=0.95)

    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    plotter.export_gltf(out_file)

    # 7. Set human-readable names and BLEND alphaMode on glTF materials, meshes, and nodes
    try:
        with open(out_file, encoding="utf-8") as f:
            d = json.load(f)

        part_names = ["Femur", "Tibia", "ACL", "Plateau", "BH_Grid", "BH_Ref", "Blumensaat"]
        if mesh_footprints.n_points > 0:
            part_names.append("Footprints")

        for i, name in enumerate(part_names):
            if i < len(d.get("materials", [])):
                d["materials"][i]["name"] = name
                d["materials"][i]["alphaMode"] = "BLEND"
                d["materials"][i]["doubleSided"] = True
            if i < len(d.get("meshes", [])):
                d["meshes"][i]["name"] = name
            if i < len(d.get("nodes", [])):
                d["nodes"][i]["name"] = name

        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(d, f)
    except Exception as e:
        print(f"Notice: Failed to name glTF parts: {e}")

    return f"/static/models/{filename}"


def generate_acl_mesh_from_mask(
    mask: np.ndarray,
    spacing: tuple,
    scan_id: str,
    color: list | None = None
) -> str:
    """Extracts real 3D isosurface mesh from binary/multiclass numpy array via PyVista."""
    if color is None:
        color = [1.0, 0.55, 0.26, 1.0]
    import pyvista as pv
    pv.global_theme.allow_empty_mesh = True

    filename = f"{scan_id}.glb"
    output_path = os.path.join(STATIC_MODELS_DIR, filename)

    acl_mask = (mask == 1).astype(np.uint8) if np.any(mask == 1) else (mask > 0).astype(np.uint8)
    padded_mask = np.pad(acl_mask, 1, mode='constant', constant_values=0)

    grid = pv.ImageData()
    grid.dimensions = padded_mask.shape
    grid.spacing = spacing
    grid.origin = (0.0, 0.0, 0.0)
    grid.point_data['values'] = padded_mask.flatten(order='F')

    mesh = grid.contour([0.5])
    if mesh.n_points > 0:
        mesh = mesh.smooth(n_iter=20, relaxation_factor=0.1)

    faces = mesh.faces.reshape(-1, 4)[:, 1:4]
    vertices = np.array(mesh.points, dtype=np.float32)

    export_mesh_to_glb(vertices, faces, output_path=output_path, color=color)
    return f"/static/models/{filename}"


def generate_curved_ligament_geometry(
    length_mm: float = 38.0,
    radius_mm: float = 5.0,
    curvature: float = 0.28,
    remodeling_factor: float = 0.8
) -> tuple[np.ndarray, np.ndarray]:
    num_slices = 48
    num_pts_per_slice = 28

    z_vals = np.linspace(-length_mm / 2.0, length_mm / 2.0, num_slices)
    vertices = []

    for z in z_vals:
        t = z / (length_mm / 2.0)
        flare = 1.0 + 0.45 * (t ** 2)
        r_current = radius_mm * flare * (0.9 + 0.2 * remodeling_factor)

        center_x = curvature * 14.0 * np.sin((t + 1) * np.pi / 2.2)
        center_y = curvature * 10.0 * np.cos((t + 1) * np.pi / 2.5)
        twist_angle = t * 0.55

        angles = np.linspace(0, 2 * np.pi, num_pts_per_slice, endpoint=False) + twist_angle
        for theta in angles:
            rx = r_current * (1.0 + 0.15 * np.sin(2 * theta))
            ry = r_current * 0.78
            striation = 1.0 + 0.04 * np.cos(6 * theta)
            x = center_x + rx * striation * np.cos(theta)
            y = center_y + ry * striation * np.sin(theta)
            vertices.append([x, y, z])

    vertices = np.array(vertices, dtype=np.float32)

    faces = []
    for s in range(num_slices - 1):
        for p in range(num_pts_per_slice):
            p_next = (p + 1) % num_pts_per_slice
            curr_row = s * num_pts_per_slice
            next_row = (s + 1) * num_pts_per_slice
            p1 = curr_row + p
            p2 = curr_row + p_next
            p3 = next_row + p
            p4 = next_row + p_next
            faces.append([p1, p2, p3])
            faces.append([p2, p4, p3])

    faces = np.array(faces, dtype=np.uint32)
    return vertices, faces


def generate_acl_mesh_glb(
    scan_id: str,
    volume_mm3: float = 2600.0,
    integrity_score: float = 75.0,
    mask: np.ndarray | None = None,
    spacing: tuple | None = None,
    full_knee: bool = True,
    vis_data: dict[str, Any] | None = None
) -> str:
    """Generates 3D mesh model (isolated ACL or full knee assembly with Femur, Tibia, Plateau, B&H Grid)."""
    # If full knee requested with multiclass mask
    if full_knee and mask is not None and spacing is not None and np.any(mask == 2):
        try:
            return generate_complete_knee_gltf(scan_id, mask, spacing, vis_data)
        except Exception as e:
            print(f"Notice: Failed to generate complete knee gltf: {e}")

    # If full knee requested and default full knee exists, serve it
    default_full_path = os.path.join(STATIC_MODELS_DIR, "default_knee_full.gltf")
    if full_knee and os.path.exists(default_full_path) and os.path.getsize(default_full_path) > 1000:
        return "/static/models/default_knee_full.gltf"

    filename = f"{scan_id}.glb"
    file_path = os.path.join(STATIC_MODELS_DIR, filename)

    if os.path.exists(file_path) and os.path.getsize(file_path) > 100:
        return f"/static/models/{filename}"

    if integrity_score >= 80.0:
        color = [1.0, 0.58, 0.22, 1.0]
    elif integrity_score >= 65.0:
        color = [0.98, 0.48, 0.32, 1.0]
    else:
        color = [0.92, 0.38, 0.42, 1.0]

    if mask is not None and spacing is not None and np.any(mask > 0):
        try:
            return generate_acl_mesh_from_mask(mask, spacing, scan_id, color=color)
        except Exception:
            pass

    length_mm = 36.0 + (volume_mm3 / 2500.0) * 2.0
    radius_mm = 4.2 + (volume_mm3 / 3000.0) * 1.5
    remodeling_factor = min(1.0, max(0.4, integrity_score / 100.0))

    try:
        import pyvista as pv
        pv.global_theme.allow_empty_mesh = True
        v, f = generate_curved_ligament_geometry(length_mm, radius_mm, 0.28, remodeling_factor)
        poly = pv.PolyData(v, np.hstack([[3, *face] for face in f]))
        smoothed = poly.smooth(n_iter=15, relaxation_factor=0.08)
        v_smooth = np.array(smoothed.points, dtype=np.float32)
        export_mesh_to_glb(v_smooth, f, output_path=file_path, color=color)
    except Exception:
        v, f = generate_curved_ligament_geometry(length_mm, radius_mm, 0.28, remodeling_factor)
        export_mesh_to_glb(v, f, output_path=file_path, color=color)

    return f"/static/models/{filename}"
