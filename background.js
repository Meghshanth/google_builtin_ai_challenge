let promptExamples= [
    { role: "system", content: "Make a list of the input for the user, each point should start with * and end with ., have a single space between each points. And do not make the list anything extra or outside of the user input, always make points from what is given., If no user input, do not provide any output" },
    { role: "user", content: "This week I need to finish my assignments by Thursday I need to get my groceries on Friday and then I have to meet my friends on Saturday" },
    { role: "assistant", content: "*Thursday: Finish assignments. *Friday: Get groceries. *Saturday: Meet friends." },
    { role: "user", content: "I need to finish my UI designs I need to call for a project for which I have to speak with my teammates decide an idea and then I have to meet my friends on Saturday" },
    { role: "assistant", content: "*Finish UI designs. *Meet friends on Saturday. *Call for a project, speak with teammates, decide on an idea." },
    { role: "user", content: "" },
    { role: "assistant", content: "" }
]

// Listen for microphone access changes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CHECK_MIC_ACCESS') {
        chrome.storage.local.get(['micAccessGranted'], (result) => {
            sendResponse({
                micAccessGranted: result.micAccessGranted || false
            });
        });
        return true;
    }

    if (message.type === 'REMOVE_MIC_ACCESS') {

        chrome.storage.local.remove('micAccessGranted', () => {
            // Broadcast state change to all side panel instances
            chrome.runtime.sendMessage({ type: 'MIC_ACCESS_STATE_CHANGED', granted: false });
            sendResponse({ success: true });
        });
        return true;
    }

    if (message.type === 'MIC_ACCESS_GRANTED') {
        chrome.storage.local.set({ micAccessGranted: true }, () => {
            // Broadcast state change to all side panel instances
            chrome.runtime.sendMessage({ type: 'MIC_ACCESS_STATE_CHANGED', granted: true });
            sendResponse({ success: true });
        });
        return true;
    }

});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PROCESS_AI_PROMPT') {
        // Process the AI prompt using the language model
        processAiPrompt(message.prompt);
        sendResponse({ success: true });
        return true;
    }
});

async function processAiPrompt(prompt) {
    const { available } = await ai.languageModel.capabilities();

    if (available !== "no") {
        const session = await ai.languageModel.create({
            initialPrompts: promptExamples
        });
        console.log(available);

        const stream = await session.prompt(prompt);
        console.log(stream);

        const points = stream.split('*').map(item => item.trim()).filter(item => item !== "");

        console.log(points);

        // Handle userLists in local storage
        if (points.length > 1) {
            chrome.storage.local.get(['userLists'], (result) => {
                let userLists = result.userLists || [];  // Initialize userLists if not already set

                // Generate ID for the new list entry
                const newId = userLists.length > 0 ? userLists[userLists.length - 1].id + 1 : 1;

                // Create the new list entry with the new ID and points
                const newList = {
                    id: newId,
                    list: points
                };

                // Add the new list to the userLists array
                userLists.push(newList);

                // Save the updated userLists back to local storage
                chrome.storage.local.set({ userLists }, () => {
                    console.log(`New list added with ID ${newId}`);
                });
            });
        }

        chrome.runtime.sendMessage({ type: 'AI_COMPLETE_OUTPUT', output: stream });
    } else {
        // Handle cases where the AI model is unavailable
        console.error("AI model is not available.");
    }
}

