import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import EvidenceToProposalEngine from "./components/EvidenceToProposalEngine";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EvidenceToProposalEngine />
  </StrictMode>
);
