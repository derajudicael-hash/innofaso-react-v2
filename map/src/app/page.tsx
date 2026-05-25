import FactoryMap from "../components/FactoryMap";
import ZoneSidebar from "../components/ZoneSidebar";
import Topbar from "../components/Topbar";
import MapLegend from "../components/MapLegend";

export default function HomePage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <Topbar />

      {/* Map + Sidebar row */}
      <div className="flex flex-1 overflow-hidden">
        <FactoryMap />
        <ZoneSidebar />
      </div>

      <MapLegend />
    </div>
  );
}
