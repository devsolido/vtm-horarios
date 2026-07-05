# VTM Integração – Sistema de Consulta de Horários

**SERVE PARA:** exibir os horários de ônibus da **Vale Transporte Marabá** de forma organizada, com filtros por dia da semana, relógio em tempo real, clima local e design responsivo.

---

## 📂 Estrutura do projeto
vtm-horarios/
├── index.html # Página principal
├── README.md # Instruções
└── .vscode/
└── settings.json # Configurações do VS Code
   
---

## 🚀 Como usar

1. Abra o arquivo `index.html` em qualquer navegador.
2. Clique em "Entrar" no pop-up de boas‑vindas.
3. Use os filtros para ver os horários por dia.
4. Os cards mostram destino, horário, embarque e dias.

---

## ✏️ Como adicionar/editar horários

No arquivo `index.html`, localize a seção:

```javascript
// ⭐ ALTERE AQUI OS HORÁRIOS – Adicione ou remova objetos neste array