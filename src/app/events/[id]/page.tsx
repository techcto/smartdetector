import EventDetail from './event-detail';
export default async function EventPage({ params,searchParams }: { params: Promise<{ id: string }>;searchParams:Promise<{device?:string}> }) {
  const { id } = await params;
  const {device}=await searchParams;
  return <EventDetail id={id} returnDevice={device}/>;
}
