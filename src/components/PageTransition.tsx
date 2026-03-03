import { PropsWithChildren, useEffect, useState } from "react";

const PageTransition = ({ children }: PropsWithChildren) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div
      className={`transition-all duration-300 ease-out will-change-transform ${
        ready ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      {children}
    </div>
  );
};

export default PageTransition;
