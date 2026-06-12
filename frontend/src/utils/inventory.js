export function getStatus(qty, reorder) {
  if (qty <= reorder) return 'critical';
  if (qty <= reorder * 1.5) return 'low-stock';
  return 'healthy';
}

export function getItemStatus(item) {
  if ('available_quantity_ml' in item) {
    return getStatus(parseFloat(item.available_quantity_ml), parseFloat(item.reorder_level || 0));
  }
  if ('available_quantity_pieces' in item) {
    return getStatus(parseFloat(item.available_quantity_pieces), parseFloat(item.reorder_level || 0));
  }
  return 'healthy';
}
