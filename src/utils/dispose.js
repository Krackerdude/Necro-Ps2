/**
 * Recursively dispose a three.js object tree: geometries, materials, and any
 * textures hanging off material slots. Safe to call on anything.
 */
export function disposeObject3D(root) {
  root.traverse((node) => {
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose();
      }
      material.dispose?.();
    }
  });
  root.removeFromParent?.();
}
