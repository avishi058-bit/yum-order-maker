import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { pageTransition } from "@/config/uiConfig";

/** Fades each page in when the route changes (query/hash changes do not replay it). */
const PageTransition = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  return (
    <>
      <style>{pageTransition.css}</style>
      <div key={pathname} className="page-fade-in">
        {children}
      </div>
    </>
  );
};

export default PageTransition;
