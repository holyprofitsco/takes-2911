export function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <div className="page">
      <h1 className="page-title">{title}</h1>
      <div className="placeholder">
        <p>{note}</p>
      </div>
    </div>
  )
}
