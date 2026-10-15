export function Loading({ children }) {
  return (
    <p className="banner" role="status">
      {children}
    </p>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p className="banner error" role="alert">
      {children}
    </p>
  );
}

export function Empty({ children }) {
  return <p className="banner empty">{children}</p>;
}
