import React from 'react';
import './ConfirmDialog.css';

/**
 * Custom confirm/alert dialog to avoid browser "localhost:3000 says" in the title.
 * Use for confirm: open, message, onConfirm, onCancel, confirmLabel, cancelLabel.
 * Use for alert: open, message, onConfirm, confirmLabel, cancelLabel={null} or showCancel={false}.
 */
function ConfirmDialog({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  showCancel = true,
  onConfirm,
  onCancel,
  variant = 'confirm', // 'confirm' | 'danger' | 'alert'
}) {
  if (!open) return null;

  const handleConfirm = () => {
    onConfirm?.();
  };

  const handleCancel = () => {
    onCancel?.();
  };

  return (
    <div className="confirm-dialog-overlay" onClick={handleCancel}>
      <div className="confirm-dialog-box" onClick={(e) => e.stopPropagation()}>
        {title && <div className="confirm-dialog-title">{title}</div>}
        <div className="confirm-dialog-message">{message}</div>
        <div className="confirm-dialog-actions">
          {showCancel && cancelLabel && (
            <button type="button" className="confirm-dialog-btn cancel" onClick={handleCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            className={`confirm-dialog-btn confirm ${variant === 'danger' ? 'danger' : ''}`}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
