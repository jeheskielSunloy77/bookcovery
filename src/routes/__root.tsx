import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
      },
      {
        name: 'theme-color',
        content: '#080b10',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'black-translucent',
      },
      {
        title: 'Bookcovery — Real-Time AR Book Scanner',
      },
      {
        name: 'description',
        content: 'Scan books in real-time with AI and view Goodreads & Open Library ratings in AR.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'preconnect',
        href: 'https://covers.openlibrary.org',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark bg-[#080b10]" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-[#080b10] text-neutral-100 overflow-hidden select-none" suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
