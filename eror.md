## Error Type
Runtime Error

## Error Message
Invalid src prop (https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1800&q=80) on `next/image`, hostname "images.unsplash.com" is not configured under images in your `next.config.js`
See more info: https://nextjs.org/docs/messages/next-image-unconfigured-host


    at defaultLoader (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_0x_an-p._.js:3036:49)
    at <unknown> (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_0x_an-p._.js:460:39)
    at Array.map (<anonymous>:null:null)
    at generateImgAttrs (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_0x_an-p._.js:460:24)
    at getImgProps (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_0x_an-p._.js:873:27)
    at <unknown> (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_0x_an-p._.js:3439:82)
    at Object.react_stack_bottom_frame (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_058-ah~._.js:15037:24)
    at renderWithHooks (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_058-ah~._.js:4620:24)
    at updateForwardRef (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_058-ah~._.js:5908:21)
    at beginWork (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_058-ah~._.js:6766:24)
    at runWithFiberInDEV (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_058-ah~._.js:965:74)
    at performUnitOfWork (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_058-ah~._.js:9555:97)
    at workLoopSync (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_058-ah~._.js:9449:40)
    at renderRootSync (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_058-ah~._.js:9433:13)
    at performWorkOnRoot (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_058-ah~._.js:9098:47)
    at performWorkOnRootViaSchedulerTask (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_058-ah~._.js:10255:9)
    at MessagePort.performWorkUntilDeadline (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/node_modules_next_dist_compiled_0rpq4pf._.js:2647:64)
    at Hero (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/src_components_landing-page_tsx_0xyclhl._.js:559:229)
    at LandingPage (file://D:/web kp/ecommerce-kp/frontend/.next/dev/static/chunks/src_components_landing-page_tsx_0xyclhl._.js:1618:215)
    at Page (src\app\page.tsx:4:10)

## Code Frame
  2 |
  3 | export default function Page() {
> 4 |   return <LandingPage />;
    |          ^
  5 | }
  6 |

Next.js version: 16.2.4 (Turbopack)
