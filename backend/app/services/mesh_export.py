import os
import json
import struct
import numpy as np
from typing import Tuple, Optional

# Palette colors inspired by ACL graft analysis suite
ACL_ORANGE = [1.0, 0.55, 0.26, 1.0]     # Vivid graft orange (#ff8c42)
BONE_BEIGE = [0.91, 0.86, 0.78, 1.0]     # Warm bone ivory (#e8dcc8)

STATIC_MODELS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "static", "models")
)


def export_mesh_to_glb(
    vertices: np.ndarray,
    faces: np.ndarray,
    normals: Optional[np.ndarray] = None,
    output_path: str = "",
    color: list = ACL_ORANGE
) -> str:
    """
    Export 3D triangular mesh to a standard standalone binary glTF (.glb) file.
    Follows official glTF 2.0 binary container specifications.
    
    Args:
        vertices: (N, 3) float32 coordinates
        faces: (M, 3) uint32 face triangle indices
        normals: (N, 3) float32 vertex normals (computed if None)
        output_path: destination file path (.glb)
        color: RGBA base color [r, g, b, a]
    """
    vertices = np.ascontiguousarray(vertices, dtype=np.float32)
    faces = np.ascontiguousarray(faces, dtype=np.uint32)

    # Compute smooth vertex normals if not provided
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

    # Calculate bounding box for glTF accessor
    v_min = vertices.min(axis=0).tolist()
    v_max = vertices.max(axis=0).tolist()
    i_min = [int(faces.min())]
    i_max = [int(faces.max())]

    # Convert arrays to binary buffers
    pos_bytes = vertices.tobytes()
    norm_bytes = normals.tobytes()
    idx_bytes = faces.flatten().tobytes()

    # Align byte offsets to 4-byte boundaries
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

    # Construct glTF JSON document
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
                        "attributes": {
                            "POSITION": 0,
                            "NORMAL": 1
                        },
                        "indices": 2,
                        "material": 0,
                        "mode": 4  # TRIANGLES
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
        "buffers": [
            {
                "byteLength": len(bin_data)
            }
        ],
        "bufferViews": [
            {
                "buffer": 0,
                "byteOffset": offset_pos,
                "byteLength": len_pos,
                "target": 34962  # ARRAY_BUFFER
            },
            {
                "buffer": 0,
                "byteOffset": offset_norm,
                "byteLength": len_norm,
                "target": 34962  # ARRAY_BUFFER
            },
            {
                "buffer": 0,
                "byteOffset": offset_idx,
                "byteLength": len_idx,
                "target": 34963  # ELEMENT_ARRAY_BUFFER
            }
        ],
        "accessors": [
            {
                "bufferView": 0,
                "byteOffset": 0,
                "componentType": 5126,  # FLOAT
                "count": len(vertices),
                "type": "VEC3",
                "min": v_min,
                "max": v_max
            },
            {
                "bufferView": 1,
                "byteOffset": 0,
                "componentType": 5126,  # FLOAT
                "count": len(normals),
                "type": "VEC3"
            },
            {
                "bufferView": 2,
                "byteOffset": 0,
                "componentType": 5125,  # UNSIGNED_INT
                "count": len(faces.flatten()),
                "type": "SCALAR",
                "min": i_min,
                "max": i_max
            }
        ]
    }

    json_str = json.dumps(gltf, separators=(',', ':'))
    json_bytes = json_str.encode('utf-8')
    json_bytes_padded = pad4(json_bytes, pad_char=b' ')

    # GLB Header (12 bytes) + Chunk 0 (JSON) + Chunk 1 (BIN)
    total_length = 12 + 8 + len(json_bytes_padded) + 8 + len(bin_data)

    glb_header = struct.pack(
        "<4sII",
        b"glTF",       # Magic
        2,             # Version 2
        total_length   # Total length
    )

    chunk0_header = struct.pack(
        "<I4s",
        len(json_bytes_padded),
        b"JSON"
    )

    chunk1_header = struct.pack(
        "<I4s",
        len(bin_data),
        b"BIN\x00"
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(glb_header)
        f.write(chunk0_header)
        f.write(json_bytes_padded)
        f.write(chunk1_header)
        f.write(bin_data)

    return output_path


def generate_curved_ligament_geometry(
    length_mm: float = 38.0,
    radius_mm: float = 5.0,
    curvature: float = 0.28,
    remodeling_factor: float = 0.8
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generates a realistic anatomical surface geometry representing the anterior
    cruciate ligament graft, including natural twist and tibial/femoral flaring.
    """
    num_slices = 48
    num_pts_per_slice = 28

    z_vals = np.linspace(-length_mm / 2.0, length_mm / 2.0, num_slices)
    vertices = []

    for idx, z in enumerate(z_vals):
        t = z / (length_mm / 2.0)  # -1.0 to 1.0

        # Anatomical flare at femoral (top) and tibial (bottom) insertion sites
        flare = 1.0 + 0.45 * (t ** 2)
        r_current = radius_mm * flare * (0.9 + 0.2 * remodeling_factor)

        # Sagittal & coronal anatomical tilt
        center_x = curvature * 14.0 * np.sin((t + 1) * np.pi / 2.2)
        center_y = curvature * 10.0 * np.cos((t + 1) * np.pi / 2.5)

        # Spiral bundle twist (~30 degrees from femoral to tibial insertion)
        twist_angle = t * 0.55

        angles = np.linspace(0, 2 * np.pi, num_pts_per_slice, endpoint=False) + twist_angle
        for theta in angles:
            # Elliptical cross-section typical of ACL fascicles
            rx = r_current * (1.0 + 0.15 * np.sin(2 * theta))
            ry = r_current * 0.78

            # Surface striations simulating collagen fiber bundles
            striation = 1.0 + 0.04 * np.cos(6 * theta)

            x = center_x + rx * striation * np.cos(theta)
            y = center_y + ry * striation * np.sin(theta)
            vertices.append([x, y, z])

    vertices = np.array(vertices, dtype=np.float32)

    # Generate triangle index grid
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
    integrity_score: float = 75.0
) -> str:
    """
    Generates and saves the 3D ACL graft model as a .glb file in the static directory.
    
    Returns:
        Relative URL path to the model for web frontend (e.g. /static/models/scan-042-m01.glb)
    """
    filename = f"{scan_id}.glb"
    file_path = os.path.join(STATIC_MODELS_DIR, filename)

    # If already generated and valid size, return cached URL
    if os.path.exists(file_path) and os.path.getsize(file_path) > 100:
        return f"/static/models/{filename}"

    # Calculate morphometric parameters based on volume and integrity
    length_mm = 36.0 + (volume_mm3 / 2500.0) * 2.0
    radius_mm = 4.2 + (volume_mm3 / 3000.0) * 1.5
    remodeling_factor = min(1.0, max(0.4, integrity_score / 100.0))

    # Color shifts from pinkish-coral (early remodeling) to healthy vibrant orange-amber
    if integrity_score >= 80.0:
        color = [1.0, 0.58, 0.22, 1.0]  # Mature healthy amber/orange
    elif integrity_score >= 65.0:
        color = [0.98, 0.48, 0.32, 1.0] # Proliferative coral
    else:
        color = [0.92, 0.38, 0.42, 1.0] # Early post-op rose

    # Try generating surface via PyVista if available, with graceful fallback
    exported = False
    try:
        import pyvista as pv
        pv.global_theme.allow_empty_mesh = True
        
        # Procedural mesh via PyVista cylinder / surface smooth
        v, f = generate_curved_ligament_geometry(length_mm, radius_mm, 0.28, remodeling_factor)
        
        # PyVista smooth pass
        poly = pv.PolyData(v, np.hstack([[3, *face] for face in f]))
        smoothed = poly.smooth(n_iter=15, relaxation_factor=0.08)
        
        # Extract smoothed points
        v_smooth = np.array(smoothed.points, dtype=np.float32)
        export_mesh_to_glb(v_smooth, f, output_path=file_path, color=color)
        exported = True
    except Exception:
        exported = False

    if not exported:
        # Standalone guaranteed fallback generator
        v, f = generate_curved_ligament_geometry(length_mm, radius_mm, 0.28, remodeling_factor)
        export_mesh_to_glb(v, f, output_path=file_path, color=color)

    return f"/static/models/{filename}"
