import { AppShell, NavLink, Text, Title } from "@mantine/core";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import ComunidadesPage from "./pages/ComunidadesPage";
import FuncoesPage from "./pages/FuncoesPage";
import IntegrantesPage from "./pages/IntegrantesPage";
import PlaceholderPage from "./pages/PlaceholderPage";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "🏠" },
  { to: "/integrantes", label: "Integrantes", icon: "👥" },
  { to: "/comunidades", label: "Comunidades", icon: "⛪" },
  { to: "/funcoes", label: "Funções", icon: "🎤" },
  { to: "/missas", label: "Missas", icon: "📅" },
  { to: "/escalas", label: "Escalas", icon: "📋" },
  { to: "/disponibilidade", label: "Disponibilidade", icon: "🕐" },
  { to: "/historico", label: "Histórico", icon: "📊" },
  { to: "/configuracoes", label: "Configurações", icon: "⚙️" }
];

export default function App(): JSX.Element {
  const location = useLocation();

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 240, breakpoint: "sm" }} padding="md">
      <AppShell.Header>
        <Title order={4} px="md" py="xs">
          EscalaLitúrgica
        </Title>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            component={Link}
            to={item.to}
            label={item.label}
            leftSection={<Text>{item.icon}</Text>}
            active={location.pathname === item.to}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/integrantes" element={<IntegrantesPage />} />
          <Route path="/comunidades" element={<ComunidadesPage />} />
          <Route path="/funcoes" element={<FuncoesPage />} />
          <Route path="/missas" element={<PlaceholderPage title="Missas" />} />
          <Route path="/escalas" element={<PlaceholderPage title="Escalas" />} />
          <Route path="/disponibilidade" element={<PlaceholderPage title="Disponibilidade" />} />
          <Route path="/historico" element={<PlaceholderPage title="Histórico" />} />
          <Route path="/configuracoes" element={<PlaceholderPage title="Configurações" />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}
