import { redirect } from 'next/navigation';

// Login has been removed — everyone lands straight on the dashboard. The
// (app) layout still redirects to onboarding until setup is complete.
export default function IndexPage() {
  redirect('/home');
}
