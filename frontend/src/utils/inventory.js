export function getStatus(qty, reorder) {
  if (qty <= reorder) return 'critical';
  if (qty <= reorder * 1.5) return 'low-stock';
  return 'healthy';
}

export function getItemStatus(item) {
  if ('quantity' in item) {
    return getStatus(parseFloat(item.quantity), parseFloat(item.reorder_level || 0));
  }
  if ('available_quantity_pieces' in item) {
    return getStatus(parseFloat(item.available_quantity_pieces), parseFloat(item.reorder_level || 0));
  }
  return 'healthy';
}
