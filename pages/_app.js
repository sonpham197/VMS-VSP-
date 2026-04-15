import '@/styles/globals.css'
import Head from 'next/head'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Loader2 } from 'lucide-react';

function AuthGuard({ children }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // on initial load - check session
    const authCheck = () => {
      const session = localStorage.getItem('vms_session');
      if (!session && router.pathname !== '/login') {
        setAuthorized(false);
        router.push({
          pathname: '/login',
        });
      } else {
        setAuthorized(true);
      }
    };
    authCheck();

    // on route change start - hide page content
    const hideContent = () => setAuthorized(false);
    router.events.on('routeChangeStart', hideContent);
    // on route change complete - run auth check 
    router.events.on('routeChangeComplete', authCheck);

    return () => {
      router.events.off('routeChangeStart', hideContent);
      router.events.off('routeChangeComplete', authCheck);
    }
  }, [router]);

  return authorized ? children : (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
       <Loader2 className="animate-spin text-cyan-500" size={48} />
    </div>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>
      <AuthGuard>
        <Component {...pageProps} />
      </AuthGuard>
    </>
  )
}
