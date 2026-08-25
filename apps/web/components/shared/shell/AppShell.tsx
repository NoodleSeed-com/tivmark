import { useState } from 'react';
import { Loading } from '@/components/shared';
import { useSession } from 'next-auth/react';
import React from 'react';
import Header from './Header';
import Drawer from './Drawer';
import AssistantWidget from './AssistantWidget';
import { useRouter } from 'next/router';

export default function AppShell({ children }) {
  const router = useRouter();
  const { status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <div className="app-frame lg:pl-64">
        <Header setSidebarOpen={setSidebarOpen} />
        <main className="py-5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
            <AssistantWidget />
          </div>
        </main>
      </div>
    </div>
  );
}
