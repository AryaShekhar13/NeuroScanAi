/**
 * A non-diagnostic MRI interface concept. Tabs are fully keyboard operable and explicitly frame
 * imagery as an illustrative clinical-workspace preview rather than a medical interpretation.
 */
import { KeyboardEvent, useId, useState } from "react";
import { MRI_MODALITIES } from "@/lib/mriModalities";

type Props = {
  compact?: boolean;
};

export default function MriModalityTabs({ compact = false }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const baseId = useId();
  const active = MRI_MODALITIES[activeIndex];

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'ArrowRight'
      ? (activeIndex + 1) % MRI_MODALITIES.length
      : event.key === 'ArrowLeft'
        ? (activeIndex - 1 + MRI_MODALITIES.length) % MRI_MODALITIES.length
        : event.key === 'Home' ? 0 : MRI_MODALITIES.length - 1;
    setActiveIndex(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  };

  return (
    <div className={`mri-tabs${compact ? ' mri-tabs-compact' : ''}`}>
      <div className="modality-tabs" role="tablist" aria-label="MRI modalities">
        {MRI_MODALITIES.map((modality, index) => (
          <button
            key={modality.id}
            id={`${baseId}-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            aria-controls={`${baseId}-panel-${index}`}
            tabIndex={index === activeIndex ? 0 : -1}
            onClick={() => setActiveIndex(index)}
            onKeyDown={onKeyDown}>
            {modality.label}
          </button>
        ))}
      </div>
      <div
        id={`${baseId}-panel-${activeIndex}`}
        className={`mri-panel modality-${active.id}`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${activeIndex}`}>
        <div className="mri-slice" aria-hidden="true">
          <span className="mri-slice-core" />
          <span className="mri-slice-signal" />
          <span className="mri-crosshair mri-crosshair-x" />
          <span className="mri-crosshair mri-crosshair-y" />
          <span className="mri-corner mri-corner-top">AXIAL · {active.label}</span>
          <span className="mri-corner mri-corner-bottom">SLICE 082 / 156</span>
        </div>
        <div className="mri-panel-footer">
          <span>{active.detail}</span>
          <span>Illustrative interface only</span>
        </div>
      </div>
    </div>
  );
}
