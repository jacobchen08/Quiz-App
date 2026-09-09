import requests
import sqlite3

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow React (running on port 5173) to send requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

num_questions = 10
type_of_question = "all"
difficulty = "all" 

#api call to get questions

#sets the url based on the type of question and difficulty selected by the user

if  type_of_question == "all":
    if difficulty == "all":
        url = f"https://opentdb.com/api.php?amount={num_questions}"
    else:
        url = f"https://opentdb.com/api.php?amount={num_questions}&difficulty={difficulty}"
else:
    if difficulty == "all":
        url = f"https://opentdb.com/api.php?amount={num_questions}&type={type_of_question}"
    else:
        url = f"https://opentdb.com/api.php?amount={num_questions}&type={type_of_question}&difficulty={difficulty}"

#makes the POST request to the API
#checks if the request was successful
#if successful, the data is returned
#if not successful, an error message is returned
POST_request = requests.post(url)
if POST_request.status_code == 200:
    data = POST_request.json()
    questions = data["results"]
    return questions
else:
    return {"error": "Failed to fetch questions"}


#returns the questions to the frontend, where it can be retrieved with a GET request

@app.get("/questions")
def get_questions():
    return questions











