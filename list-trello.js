const axios = require("axios");
require("dotenv").config();

const TRELLO_KEY = process.env.TRELLO_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const BOARD_ID = process.env.TRELLO_BOARD_ID;

const BASE_URL = "https://api.trello.com/1";
const AUTH_PARAMS = `key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;

async function listCards() {
    try {
        const response = await axios.get(`${BASE_URL}/boards/${BOARD_ID}/cards?${AUTH_PARAMS}`);
        const cards = response.data;
        console.log(`Found ${cards.length} cards.`);
        for (const card of cards) {
            console.log(`- [${card.id}] ${card.name}`);
        }
    } catch (error) {
        console.error("Error fetching Trello cards:", error.message);
    }
}

listCards();
