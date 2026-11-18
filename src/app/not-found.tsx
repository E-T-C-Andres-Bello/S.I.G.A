import { SigaErrorScreen } from "@/components/ui/siga-error-screen";

export default function NotFoundPage() {
  return (
    <SigaErrorScreen
      statusCode="Error 404"
      title="Página o módulo no encontrado"
      description="La ruta que intentas abrir no existe o fue movida dentro del Sistema Integral de Gestión Académica S.I.G.A."
      homeHref="/"
      homeLabel="Volver al inicio"
    />
  );
}
