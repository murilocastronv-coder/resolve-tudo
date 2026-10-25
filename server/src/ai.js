import OpenAI from 'openai';

const categoryNames = {
  compras: 'compras e entregas',
  cobrancas: 'contas e cobranças',
  servicos: 'serviços contratados',
  outros: 'outro problema cotidiano'
};

export async function solveProblem({ title, description, category }) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      guidance: `Modo de demonstração: organize comprovantes, datas, números de pedido e protocolos. Para ${categoryNames[category] || 'este problema'}, entre em contato pelo canal oficial da empresa e guarde o registro da conversa. Confirme os direitos e prazos aplicáveis em fontes oficiais. Esta resposta não foi gerada por IA porque OPENAI_API_KEY não está configurada.`,
      complaintMessage: `Olá. Preciso de ajuda com o seguinte problema: ${title}. ${description}\n\nPeço, por favor, que informem uma solução e o prazo previsto para atendimento. Poderiam registrar esta solicitação e informar o número do protocolo? Obrigado(a).`,
      links: [
        { label: 'Consumidor.gov.br', url: 'https://www.consumidor.gov.br/' },
        { label: 'Portal gov.br', url: 'https://www.gov.br/' }
      ],
      mode: 'demo'
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Você é o assistente informativo do Resolve Tudo, para consumidores brasileiros. Responda em português brasileiro claro, sem afirmar que é advogado nem inventar leis, prazos, protocolos ou garantias. Se não tiver certeza, diga para confirmar em fonte oficial. Não solicite senhas, códigos bancários ou dados completos de cartão. Retorne JSON com as chaves "guidance" (3 a 5 passos simples), "complaintMessage" (mensagem educada pronta para copiar) e "links" (array de objetos label/url; use apenas domínios oficiais conhecidos, ou retorne array vazio).`
      },
      {
        role: 'user',
        content: JSON.stringify({
          title,
          description,
          category: categoryNames[category] || categoryNames.outros
        })
      }
    ]
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('A IA retornou uma resposta inválida. Tente novamente.'); }
  return {
    guidance: String(parsed.guidance || 'Não foi possível gerar orientações. Tente novamente.'),
    complaintMessage: String(parsed.complaintMessage || ''),
    links: Array.isArray(parsed.links) ? parsed.links.filter(x => x && typeof x.label === 'string' && typeof x.url === 'string' && /^https:\/\/[a-z0-9.-]+/i.test(x.url)).slice(0, 5) : [],
    mode: 'ai'
  };
}
