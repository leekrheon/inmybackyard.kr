import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import 'lenis/dist/lenis.css';
import './styles/base.css';
import './styles/chrome.css';
import './styles/home.css';
import './styles/pages.css';
import './styles/about.css';
import './styles/contact.css';
import './styles/admin.css';
import './styles/v4.css';
import './styles/v5.css';
import './styles/about2.css';
import './styles/v6.css';
import './styles/motion.css';
import './styles/insight.css';
import './styles/links.css';
import './styles/contact2.css';
import Layout from './components/Layout';
import Home from './pages/Home';
import About from './pages/About';
import Work from './pages/Work';
import WorkDetail from './pages/WorkDetail';
import Team from './pages/Team';
import Press from './pages/Press';
import Contact from './pages/Contact';
import { lazy, Suspense } from 'react';
const Admin = lazy(() => import('./pages/Admin'));
import NotFound from './pages/NotFound';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/about', element: <About /> },
      { path: '/work', element: <Work /> },
      { path: '/work/records', element: <Navigate to="/work" replace /> },
      { path: '/work/clients', element: <Navigate to="/work" replace /> },
      { path: '/work/highlight', element: <Navigate to="/work" replace /> },
      { path: '/work/:slug', element: <WorkDetail /> },
      { path: '/team', element: <Team /> },
      { path: '/press', element: <Press /> },
      { path: '/contact', element: <Contact /> },
      { path: '/contact/coffee-chat', element: <Contact /> },
      { path: '/contact/careers', element: <Navigate to="/about" replace /> },
      { path: '/admin', element: <Suspense fallback={null}><Admin /></Suspense> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
