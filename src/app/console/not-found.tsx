import Link from "next/link";

export default function ConsoleNotFound() {
  return (
    <main className="cn-center">
      <div className="card card-pad cn-narrow">
        <h1 className="cn-h1">Not found</h1>
        <p className="cn-muted">There&apos;s no console page at this address, or the record was deleted.</p>
        <Link className="btn btn-primary" href="/">Console home</Link>
      </div>
    </main>
  );
}
