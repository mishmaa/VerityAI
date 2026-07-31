import { X } from "lucide-react";

export default function Modal({ title, eyebrow, children, onClose, wide = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal-card ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>{eyebrow && <p>{eyebrow}</p>}<h2>{title}</h2></div>
          <button type="button" aria-label={`Close ${title}`} onClick={onClose}><X size={18} /></button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
