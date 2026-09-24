import requests
import sqlite3

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

#cd backend
#uvicorn apicall:app --reload --port 8000

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
category = "all"


@app.get("/questions")
def get_questions():
    
#api call to get questions

#sets the url based on the type of question and difficulty selected by the user

    url = f"https://opentdb.com/api.php?amount={num_questions}"

    if(category != "all"):
        #currently this featrure doesn't work as categories are represented by munbers, functionality
        #will be added later
        url += f"&category={category}"
    if(difficulty != "all"):
        url += f"&difficulty={difficulty}"
    if(type_of_question!="all"):
        url += f"&type={type_of_question}"
    

    #makes the POST request to the API
    #checks if the request was successful
    #if successful, the data is returned
    #if not successful, an error message is returned


    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        return data.get("results", [])
    else:
        return {"error": "Failed to fetch questions"}



#returns the questions to the frontend, where it can be retrieved with a GET request

@app.get("/count")
def change_question_count(num: int):
    global num_questions
    #restrict number of questions from being too many, max should be 50
    if 0 < num < 51:
        num_questions = num
    else:
        return{"error, number out of bounds"}


@app.get("/category")
def change_category(category_num: int):
    global category
    #there's only a certain valid list of categories so I need to restrict this
    category = category_num


@app.get("/difficulty")
def change_difficulty(diff: str):
    global difficulty
    if(diff == "easy" or diff == "medium" or diff == "hard"):
        difficulty = diff
    else:
        return{"error, invalid difficulty"}
    

@app.get("/type")
def change_type(type: str):
    global type_of_question
    if(type == "multiple" or type == "boolean"):
        type_of_question = type
    else:
        return{"error, invalid type"}










