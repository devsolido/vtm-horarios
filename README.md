# 🚌 Que Horas Passa?

[![Vercel](https://img.shields.io/badge/deploy-Vercel-000?logo=vercel)](https://quehoraspassa.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Supabase](https://img.shields.io/badge/database-Supabase-3ecf8e?logo=supabase)](https://supabase.com)

> **Consulta de horários de ônibus com interface moderna, painel administrativo e alertas inteligentes.**

---

## 📖 Sobre o projeto

**Que Horas Passa** é uma aplicação web para consulta de horários de transporte público da região de Marabá. O sistema permite que os usuários visualizem rapidamente os próximos ônibus, filtre por dias da semana, receba alertas sonoros e visuais, e reporte erros nos horários – tudo com uma interface limpa, responsiva e com suporte a tema claro/escuro.

Para detalhes técnicos sobre a origem, interpretação e precisão dos horários, consulte [Documentação técnica: horários e precisão](./HORARIOS_E_PRECISAO.md).

---

## ✨ Funcionalidades

### 👥 Usuários (front-end)
- 📋 **Listagem de horários** organizada em cards com destino, horário, ponto de embarque e dias da semana.
- 🔍 **Filtros por dia** (Segunda a Sexta, Sábado, Domingo).
- 🕒 **Próximo ônibus** com contagem regressiva em tempo real.
- 🌙 **Tema claro/escuro** (persistente no localStorage).
- 📱 **Responsivo** – adaptado para desktop, tablet e celular.
- 🔔 **Alertas inteligentes** (30 minutos antes do horário) com som e notificação visual.
- 📤 **Compartilhamento rápido** via WhatsApp ou nativo.
- 🚨 **Reporte de erros** (formulário integrado com envio de e‑mail para o administrador).
- ☁️ **Clima em tempo real** e relógio no cabeçalho.
- 🕒 **Hora de serviço sincronizada no servidor** (`/api/time`), sem depender do relógio configurado no aparelho.
- 📈 **Previsão adaptativa em modo sombra**: confirmações voluntárias de passagem, janela p10–p90 e ativação condicionada a backtesting.

### ⚙️ Backend & APIs
- 🗄️ **Banco de dados Supabase** (PostgreSQL) – armazenamento de horários e relatórios.
- 📧 **Envio de e‑mails** via Nodemailer (Gmail/Sendinblue).
- 🌤 **API de clima** (dados meteorológicos).
- 🕒 **API de hora do servidor** com fuso de serviço `America/Belem`.
- 📈 **Calibração de passagem**: aprendizado por faixa de três horas (20 viagens confirmadas), resíduo de curto prazo com decaimento de 45 minutos e liberação após MAE pelo menos 10% menor em 30 avaliações.
- 🛡 **Verificação de manutenção** com fallback.
- 📊 **Logs de erro** e **registro de ações administrativas**.

---

### Ativação da calibração de passagem

Antes de receber confirmações, aplique a migration [`20261015003000_passage_precision.sql`](./supabase/migrations/20261015003000_passage_precision.sql) no Supabase e configure `SUPABASE_SERVICE_ROLE_KEY` como variável de ambiente server-side na Vercel. Essa chave não deve ser enviada ao navegador. Até cumprir os mínimos de observações e backtesting, a aplicação mantém o prior e identifica esse estado na tela.

## 🧰 Tecnologias utilizadas

| Camada | Tecnologia |
|--------|------------|
| Frontend | HTML5, CSS3, JavaScript (vanilla) |
| Backend | Node.js (serverless functions na Vercel) |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | API de verificação de senha + e‑mail com código 2FA |
| E‑mail | Nodemailer + Gmail / Sendinblue |
| Deploy | Vercel |
| Ícones | Font Awesome |
| Fontes | Segoe UI, system fonts |
| CI/CD | GitHub + Vercel (deploy automático) |

---
