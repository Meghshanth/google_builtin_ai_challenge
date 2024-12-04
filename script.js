const tabs = [
    { id: 'generateList', loadFunction: null },
    { id: 'previousLists', loadFunction: loadPreviousLists },
    { id: 'aboutExtension', loadFunction: null }
];

tabs.forEach(tab => {
    document.getElementById(`${tab.id}Tab`).addEventListener('click', () => {
        openTab(tab.id);
        if (tab.loadFunction){ tab.loadFunction();}
    });
});

function openTab(tabName) {
    const tabContents = document.getElementsByClassName('tabContent');
    const tabLinks = document.getElementsByClassName('tabLinks');

    Array.from(tabContents).forEach(content => content.classList.remove('active'));
    Array.from(tabLinks).forEach(link => link.classList.remove('active'));

    document.getElementById(`${tabName}Content`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

const micAccessButton = document.getElementById('micAccessButton');
const startStopButton = document.getElementById('startStopButton');
const transcriptText = document.getElementById('transcriptText');
const transcript = document.getElementById('transcript');

let recognition = null;
let isRecognizing = false;

function updateUIState(micAccessGranted) {
    if (micAccessGranted) {
        micAccessButton.textContent = 'Remove Microphone Access';
        startStopButton.disabled = false;
        transcriptText.textContent = 'Ready for transcription';
    } else {
        micAccessButton.textContent = 'Allow Microphone Access';
        startStopButton.disabled = true;
        transcriptText.textContent = 'Transcription will appear here';

        // Stop recognition if it's running
        if (recognition) {
            recognition.stop();
            isRecognizing = false;
        }
    }
}

// Initial check for microphone access
chrome.runtime.sendMessage({ type: 'CHECK_MIC_ACCESS' }, (response) => {
    updateUIState(response.micAccessGranted);
});

// Listen for microphone access state changes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'MIC_ACCESS_STATE_CHANGED') {
        updateUIState(message.granted);
    }
});

micAccessButton.addEventListener('click', () => {
    if (micAccessButton.textContent === 'Allow Microphone Access') {
        // Open mic permission page in a web-accessible context
        const permissionPage = chrome.runtime.getURL('mic-permission.html');
        window.open(permissionPage, '_blank');
    } else {
        // Initiate removal process
        chrome.runtime.sendMessage({ type: 'REMOVE_MIC_ACCESS' }, (response) => {
            if (response.success) {
                updateUIState(false);
            }
        });
    }
});

startStopButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CHECK_MIC_ACCESS' }, (response) => {
        if (response.micAccessGranted) {
            if (!isRecognizing) {
                // Start speech recognition
                startRecognition();
            } else {
                // Stop speech recognition
                stopRecognition();
            }
        } else {
            transcriptText.textContent = 'Please grant microphone access first';
        }
    });
});



let cumulativeTranscript = ''; // Variable to store all spoken text
let aiPrompt = '';
let aiOutput = [];  // Store AI output here to send to localStorage

function startRecognition() {
    chrome.storage.local.get(['userLists'], (result) => {
        if (result['userLists'].length < 5) {
            // Clear previous transcript and cumulative transcript
            cumulativeTranscript = '';
            transcript.textContent = '';
            transcriptText.textContent = '';

            // Check if Web Speech API is supported
            if (!('webkitSpeechRecognition' in window)) {
                transcriptText.textContent = 'Speech recognition not supported';
                return;
            }

            recognition = new webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                isRecognizing = true;
                startStopButton.textContent = 'Stop Transcription';
                transcriptText.textContent = 'Listening...';
            };

            recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                // Update cumulative transcript with final transcript
                cumulativeTranscript += finalTranscript;

                // Display cumulative transcript with current interim results
                transcriptText.textContent = 'Listening...';
                transcript.textContent = cumulativeTranscript + interimTranscript;
                aiPrompt = cumulativeTranscript + interimTranscript;
            };

            recognition.onerror = (event) => {
                transcriptText.textContent = 'Error occurred: ' + event.error;
                stopRecognition();
            };

            recognition.onend = () => {
                if (isRecognizing) {
                    recognition.start();
                } else {
                    startStopButton.textContent = 'Start Transcription';
                    transcriptText.textContent = 'Transcription stopped';
                    transcript.textContent = 'Waiting...';
                }
            };

            recognition.start();
        } else {
            transcriptText.textContent = 'List Limit exceeded';
        }
    });
}



function stopRecognition() {
    if (recognition) {
        isRecognizing = false;
        recognition.stop();
        // Send aiPrompt to background.js for processing
        chrome.runtime.sendMessage({ type: 'PROCESS_AI_PROMPT', prompt: aiPrompt });
    }
}

// Listen for AI chunks from background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'AI_COMPLETE_OUTPUT') {
        // Instead of just appending, save the output in a list format
        aiOutput.push(message.output);

        // Send the output to the front-end
        updateTranscriptText(message.output);
    }
});

// Update the transcript area with the final output
function updateTranscriptText(output) {

    transcript.textContent = 'List is made !!';
}

// When switching to the "Previous Lists" tab, load the saved lists
function loadPreviousLists() {
    const savedListsContainer = document.getElementById('savedListsContainer');
    const selectedCheckListContent = document.getElementById('selectedCheckListContent');

    // Hide checklist content and show saved lists
    savedListsContainer.style.display = 'block';
    selectedCheckListContent.style.display = 'none';

    chrome.storage.local.get(['userLists'], (result) => {
        const userLists = result.userLists || [];
        savedListsContainer.innerHTML = '';  // Clear any previous content

        userLists.forEach((list, index) => {
            const listContainer = document.createElement('div');
            listContainer.classList.add('list-container');  // Assign class for styling
            listContainer.classList.add('hover-glow');  // Add class for glow effect

            const listIdElement = document.createElement('div');
            listIdElement.textContent = `List ID: ${list.id}`;
            listIdElement.classList.add('list-id');

            // Create delete button for the list
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.classList.add('delete-button');
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();  // Prevent event from bubbling up to the listContainer click
                deleteList(userLists, index, savedListsContainer);
            });

            // Attach the click event to the listContainer, so clicking anywhere in the container shows the checklist
            listContainer.addEventListener('click', () => {
                showChecklistItems(list);
            });

            listContainer.appendChild(listIdElement);
            listContainer.appendChild(deleteButton);
            savedListsContainer.appendChild(listContainer);
        });
    });
}

// Declare savedStates outside the function to maintain state across function calls
let savedStates = {};

function showChecklistItems(list) {
    const savedListsContainer = document.getElementById('savedListsContainer');
    const selectedCheckListContent = document.getElementById('selectedCheckListContent');

    // Hide saved lists and show checklist content
    savedListsContainer.style.display = 'none';
    selectedCheckListContent.style.display = 'block';

    // Clear any existing content in the checklist container
    selectedCheckListContent.innerHTML = '';

    // Retrieve saved checkbox states for this list
    savedStates = JSON.parse(localStorage.getItem(`list_${list.id}_states`) || '{}');

    // Create back button
    const backButton = document.createElement('button');
    backButton.textContent = 'Back';
    backButton.classList.add('back-button');
    backButton.addEventListener('click', () => {
        loadPreviousLists(); // Load the previous lists again
    });

    // Create checklist container
    const checklistContainer = document.createElement('ul');
    checklistContainer.classList.add('checklist');

    list.list.forEach((item, index) => {
        const listItem = document.createElement('li');

        // Create checkbox for each item
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('checklist-item');

        // Set checkbox state based on saved states
        checkbox.checked = savedStates[index] || false;

        // Apply strikethrough based on initial checkbox state
        if (checkbox.checked) {
            listItem.style.textDecoration = 'line-through';
        }

        // Add event listener to save checkbox state and update styling
        checkbox.addEventListener('change', () => {
            // Update saved states
            savedStates[index] = checkbox.checked;
            localStorage.setItem(`list_${list.id}_states`, JSON.stringify(savedStates));

            // Update styling
            if (checkbox.checked) {
                listItem.style.textDecoration = 'line-through';
            } else {
                listItem.style.textDecoration = 'none';
            }
        });

        // Add the checkbox and text to the list item
        listItem.appendChild(checkbox);
        listItem.appendChild(document.createTextNode(item));
        checklistContainer.appendChild(listItem);
    });

    // Add the back button and checklist to the selected content container
    selectedCheckListContent.appendChild(backButton);
    selectedCheckListContent.appendChild(checklistContainer);
}

// Modify the delete function to work with the global savedStates
function deleteList(userLists, index, savedListsContainer) {
    // Remove the saved states for the deleted list
    localStorage.removeItem(`list_${userLists[index].id}_states`);

    // Remove the selected list from the array
    userLists.splice(index, 1);

    // Decrease the ID of the following lists and update their saved states
    for (let i = index; i < userLists.length; i++) {
        const oldId = userLists[i].id;
        userLists[i].id -= 1;
        const newId = userLists[i].id;

        // Update localStorage keys for checkbox states
        const oldStates = localStorage.getItem(`list_${oldId}_states`);
        if (oldStates) {
            localStorage.setItem(`list_${newId}_states`, oldStates);
            localStorage.removeItem(`list_${oldId}_states`);
        }
    }

    // Save the updated list back to localStorage
    chrome.storage.local.set({ userLists: userLists }, () => {
        // Re-load the previous lists after deletion
        loadPreviousLists();
    });
}