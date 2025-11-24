export default function StatusBar() {
    return (
        <div className="status-bar">
            <p className="status-bar-field">Ready 👺</p>
            <p className="status-bar-field">
                <div className="progress-indicator segmented">
                    <span className="progress-indicator-bar w-[50%]"></span>
                </div>
            </p>
            <p className="status-bar-field">--:--</p>
        </div>
    );
}