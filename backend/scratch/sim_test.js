const { ChatService } = require('../dist/services/chatService');
const { AIService } = require('../dist/services/aiService');

async function testInventoryResponse() {
    const chatService = new ChatService();
    const message = "Qual é o estado atual do meu inventário?";
    const userId = "test-user";
    const companyId = "test-company"; // In an empty DB, this will trigger the new empty state logic

    console.log("--- SIMULANDO PERGUNTA DO UTILIZADOR ---");
    console.log(`Mensagem: "${message}"`);
    console.log("\n--- PROCESSANDO... ---");

    try {
        // We use the service to see what context is built and what response is generated
        const response = await chatService.processMessage(message, userId, companyId);
        console.log("\n--- RESPOSTA DA IA ---");
        console.log(response);
    } catch (error) {
        console.error("Erro no teste:", error.message);
    }
}

testInventoryResponse();
