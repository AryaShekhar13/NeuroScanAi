import { type KeyboardEvent, useEffect, useId, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, RotateCcw } from "lucide-react";
import { MRI_MODALITIES } from "@/lib/mriModalities";
import { SYNTHETIC_DEMO_VOLUMES, clampSliceIndex, neighboringSliceIndices, nextSliceIndex, previousSliceIndex, sliceIndexForKey, type MriModalityId } from "@/lib/mriVolume";

type ImageStatus = "loading" | "ready" | "error";

export default function MriSliceNavigator() {
  const [activeModality, setActiveModality] = useState<MriModalityId>("t1");
  const [currentSlice, setCurrentSlice] = useState(0);
  const [imageStatus, setImageStatus] = useState<ImageStatus>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const baseId = useId();
  const volume = SYNTHETIC_DEMO_VOLUMES[activeModality];
  const slice = volume.slices[currentSlice];
  const activeDetails = MRI_MODALITIES.find((modality) => modality.id === activeModality)!;

  useEffect(() => {
    setCurrentSlice((sliceIndex) => clampSliceIndex(sliceIndex, volume.totalSlices));
  }, [volume.totalSlices]);

  useEffect(() => {
    let isCurrent = true;
    setImageStatus("loading");
    neighboringSliceIndices(currentSlice, volume.totalSlices).forEach((sliceIndex) => {
      const preload = new Image();
      preload.src = volume.slices[sliceIndex]!.url;
      if (sliceIndex === currentSlice) {
        preload.onload = () => { if (isCurrent) setImageStatus("ready"); };
        preload.onerror = () => { if (isCurrent) setImageStatus("error"); };
      }
    });
    return () => { isCurrent = false; };
  }, [activeModality, currentSlice, retryKey, volume]);

  const setSlice = (target: number) => setCurrentSlice(clampSliceIndex(target, volume.totalSlices));
  const onViewportKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = sliceIndexForKey(event.key, currentSlice, volume.totalSlices);
    if (target === null) return;
    event.preventDefault();
    setSlice(target);
  };
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, modalityIndex: number) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "ArrowRight" ? (modalityIndex + 1) % MRI_MODALITIES.length : event.key === "ArrowLeft" ? (modalityIndex - 1 + MRI_MODALITIES.length) % MRI_MODALITIES.length : event.key === "Home" ? 0 : MRI_MODALITIES.length - 1;
    setActiveModality(MRI_MODALITIES[next]!.id);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  };

  return <section className="slice-navigator" aria-label="Synthetic MRI slice viewer">
    <div className="modality-tabs" role="tablist" aria-label="MRI modalities">
      {MRI_MODALITIES.map((modality, index) => <button key={modality.id} id={`${baseId}-tab-${index}`} type="button" role="tab" aria-selected={modality.id === activeModality} aria-controls={`${baseId}-panel`} tabIndex={modality.id === activeModality ? 0 : -1} onClick={() => setActiveModality(modality.id)} onKeyDown={(event) => onTabKeyDown(event, index)}>{modality.label}</button>)}
    </div>
    <div id={`${baseId}-panel`} className={`slice-viewport modality-${activeModality}`} role="tabpanel" aria-labelledby={`${baseId}-tab-${MRI_MODALITIES.findIndex((modality) => modality.id === activeModality)}`} tabIndex={0} onKeyDown={onViewportKeyDown} aria-label={`${activeDetails.label} synthetic MRI volume, slice ${currentSlice + 1} of ${volume.totalSlices}. Use left and right arrows to move through slices.`}>
      <img key={`${activeModality}-${currentSlice}-${retryKey}`} src={slice?.url} alt={`Synthetic MRI demo data: ${activeDetails.label}, slice ${currentSlice + 1} of ${volume.totalSlices}`} onLoad={() => setImageStatus("ready")} onError={() => setImageStatus("error")} />
      <span className="slice-crosshair slice-crosshair-x" aria-hidden="true" /><span className="slice-crosshair slice-crosshair-y" aria-hidden="true" />
      <span className="slice-viewport-label">AXIAL · {activeDetails.label}</span><span className="slice-viewport-counter">SLICE {String(currentSlice + 1).padStart(3, "0")} / {String(volume.totalSlices).padStart(3, "0")}</span>
      <span className="demo-data-badge">Synthetic demo data · not for diagnosis</span>
      {imageStatus === "loading" && <span className="slice-load-state"><LoaderCircle className="spin-icon" size={14} /> Loading slice {currentSlice + 1}…</span>}
      {imageStatus === "error" && <div className="slice-load-error" role="status">Unable to load slice {currentSlice + 1}<button type="button" onClick={() => setRetryKey((key) => key + 1)}><RotateCcw size={13} /> Retry</button></div>}
    </div>
    <div className="slice-navigator-footer">
      <p>{activeDetails.detail}</p><p>Sequence supplied for interaction testing only</p>
    </div>
    <div className="slice-controls">
      <button type="button" className="slice-step" onClick={() => setSlice(previousSliceIndex(currentSlice, volume.totalSlices))} disabled={currentSlice === 0}><ChevronLeft size={16} /> Previous</button>
      <label className="slice-slider-label">Slice {currentSlice + 1} / {volume.totalSlices}<input type="range" min="0" max={volume.totalSlices - 1} value={currentSlice} aria-label="MRI slice number" onChange={(event) => setSlice(Number(event.target.value))} /></label>
      <button type="button" className="slice-step" onClick={() => setSlice(nextSliceIndex(currentSlice, volume.totalSlices))} disabled={currentSlice === volume.totalSlices - 1}>Next <ChevronRight size={16} /></button>
    </div>
  </section>;
}
