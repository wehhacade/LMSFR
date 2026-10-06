"use client";

import { useServerInsertedHTML } from "next/navigation";

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("lmsbr-theme")||"light";document.documentElement.setAttribute("data-theme",t);document.documentElement.classList.toggle("dark",t==="dark");document.documentElement.style.colorScheme=t;var n=localStorage.getItem("lmsbr-navMode");if(n!=="horizontal"&&n!=="vertical"){var m=document.cookie.match(/(?:^|;\\s*)lmsbr_nav_layout=([^;]*)/);n=m?decodeURIComponent(m[1]):null;}document.documentElement.setAttribute("data-nav-layout",n==="horizontal"?"horizontal":"vertical");}catch(e){}})();`;

/** Injects theme/nav init before paint via SSR — avoids React 19 script-in-component warning. */
export function ThemeInitScript() {
  useServerInsertedHTML(() => (
    <script
      id="lmsbr-theme-init"
      dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
    />
  ));

  return null;
}
