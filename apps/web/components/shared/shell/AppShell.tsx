import { useState } from 'react';
import { Loading } from '@/components/shared';
import { useSession } from 'next-auth/react';
import React from 'react';
import Header from './Header';
import Drawer from './Drawer';
import AssistantWidget from './AssistantWidget';
import { resolveAssistantSurface } from './assistantSurface';
import { useRouter } from 'next/router';

export default function AppShell({ children }) {
  const router = useRouter();
  const { status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const assistantSurface = resolveAssistantSurface(router.pathname);
  const isMarkCanvas = assistantSurface === 'canvas';

  if (status === 'loading') {
    return <Loading />;
  }

  if (status === 'unauthenticated') {
    router.push('/auth/login');
    return;
  }

  return (
    <div className="min-h-screen bg-ui-canvas text-ui-text">
      <Drawer sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="lg:pl-64">
        <Header setSidebarOpen={setSidebarOpen} />
        <main
          className={
            isMarkCanvas ? 'h-[calc(100dvh-3.5rem)] p-3 sm:p-5 lg:p-6' : 'py-5'
          }
        >
          <div
            className={
              isMarkCanvas
                ? 'relative mx-auto h-full max-w-7xl'
                : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'
            }
          >
            {children}
            <AssistantWidget surface={assistantSurface} />
          </div>
        </main>
      </div>
    </div>
  );
}
