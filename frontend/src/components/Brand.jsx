import { ShieldCheck } from "lucide-react";

export default function Brand({ compact = false }) {
  return (
    <div className="brand" aria-label="VerityAI home">
      <span className="brand-mark"><ShieldCheck size={19} strokeWidth={2.4} /></span>
      {!compact && <span>Verity<span className="brand-ai">AI</span></span>}
    </div>
  );
}
