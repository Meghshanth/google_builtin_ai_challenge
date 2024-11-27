const form = document.getElementById("textForm");
const textInput = document.getElementById("textInput");
const output = document.getElementById("output");

// Add a submit event listener to the form
form.addEventListener("submit", (event) => {
    // Prevent the page from reloading
    event.preventDefault();

    // Get the user input value
    const userInput = textInput.value;

    promptApiOutput(userInput);
});

async function promptApiOutput(input){
    // Start by checking if it's possible to create a session based on the availability of the model, and the characteristics of the device.
    const {available, defaultTemperature, defaultTopK, maxTopK } = await ai.languageModel.capabilities();

    if (available !== "no") {
        output.textContent = `Model State: ${available}`;
        const session = await ai.languageModel.create();

        // Prompt the model and wait for the whole result to come back.
        output.textContent = await session.prompt(input);
    }
}
