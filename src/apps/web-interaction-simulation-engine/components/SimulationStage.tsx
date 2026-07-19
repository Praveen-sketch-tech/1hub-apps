import { forwardRef } from 'react'

export const SimulationStage = forwardRef<HTMLDivElement>(function SimulationStage(_, ref) {
  return (
    <div className="wis-stage-shell" ref={ref}>
      <div className="wis-stage-toolbar">
        <span className="wis-stage-dot" /><span className="wis-stage-dot" /><span className="wis-stage-dot" />
        <div className="wis-address">local-demo://sample-product</div>
      </div>
      <div className="wis-step-label" data-sim-step-label>Ready to simulate</div>
      <div className="wis-viewport" data-sim-viewport>
        <div className="wis-demo-content">
          <h3>Sample Product Workspace</h3>
          <p>This sandbox lets the engine demonstrate structured actions without controlling arbitrary external websites.</p>
          <div className="wis-form-grid">
            <label>Search<input data-sim-id="search" placeholder="Search tools" /></label>
            <label>Category<select data-sim-id="category" defaultValue="all"><option value="all">All</option><option value="design">Design</option><option value="developer">Developer</option></select></label>
          </div>
          <div className="wis-upload" data-sim-id="upload"><strong>Drop a demo asset</strong><span data-upload-name>No file selected</span></div>
          <div className="wis-preview" data-sim-id="preview"><strong>Live preview</strong><span>Double-click target</span></div>
          <div className="wis-dnd-row">
            <div className="wis-drag-card" data-sim-id="drag-card">Drag me</div>
            <div className="wis-drop-zone" data-sim-id="drop-zone">Drop zone</div>
          </div>
          <button className="wis-demo-cta" data-sim-id="cta" type="button">Generate Demo</button>
          <div className="wis-result-card"><strong>Result area</strong><p>Simulation events stay local to this controlled stage.</p></div>
        </div>
        <div className="wis-cursor" data-sim-cursor data-x="24" data-y="24" aria-hidden="true"><span /></div>
      </div>
    </div>
  )
})
