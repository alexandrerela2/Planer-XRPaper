export default function Home() {
  if (typeof window !== 'undefined') {
    window.location.replace('/msr');
  }
  return null;
}
