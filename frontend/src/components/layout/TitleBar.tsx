export default function TitleBar() {
    return (
        <div className="title-bar">
            <div className="title-bar-text">
                <span>🌋 OptiMux</span>
            </div>
            <div className="title-bar-controls">
                <button aria-label="Minimize" />
                <button aria-label="Maximize" />
                <button aria-label="Close" />
            </div>
        </div>
    );
}