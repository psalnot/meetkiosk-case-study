
import { 
  Outlet, 
  Scripts, 
  Links, 
  Meta,
  ScrollRestoration, 
} from "@remix-run/react";

export default function App() {
  return (
    <html lang="en">
      <head>
        
        <Meta />
        <title>Kiosk Case Study</title>
        <Links />
      </head>
      <body>
        {/*<div id="test">ROOT LOADED</div>*/}
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
