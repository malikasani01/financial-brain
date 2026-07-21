import { redirect } from 'next/navigation';

// The middleware sends unauthenticated users to /sign-in; authenticated users
// land on the dashboard.
export default function IndexPage() {
  redirect('/home');
}
