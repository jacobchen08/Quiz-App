import './App.css';
import { useState, useMemo } from 'react';
import { useEffect } from 'react';

// start localhost 8000 in apicall.py
// cd my-react-app
// npm run dev

//to do list: make the user be able to change the number of questions, difficulty, and category of questions. Make the user be able to select the correct answer and see if they are right or wrong. Make the user be able to see their score at the end of the quiz. Make the user be able to restart the quiz.



function App() {
  const [category, setCategory] = useState([]);
  const [correctAnswer, setAnswer] = useState([]);
  const [difficulty, setDifficulty] = useState([]);
  const [incorrectAnswers, setIncorrect] = useState([]);
  const [questions, setQuestions] = useState([]); // Questions
  const [type, setType] = useState([]); // Question types (multiple or boolean)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0); // New state for score
  const [answeredQuestions, setAnsweredQuestions] = useState([]); // Contains indexes of answered questions

  const [numQuestions, setNumQuestions] = useState(10) //already works
  const [commonCategory, setCommonCategory] = useState() //to be implemented
  const [commonType, setCommonType] = useState() //to be implemented
  const [commonDifficulty, setCommonDifficulty] = useState() //to be implemented

  //randomizes order of answers for multiple choice questions
  const currentOptions = useMemo(() => {
    if (questions.length === 0) return [];

    return type[currentIndex] === 'multiple'
      ? [correctAnswer[currentIndex], ...(incorrectAnswers[currentIndex] || [])]
          .sort(() => Math.random() - 0.5)
      : ['True', 'False'];
  }, [currentIndex, questions]); // Only recalculates when currentIndex or questions change

  useEffect(() => {
    setCat(commonCategory);
    setDiff(commonDifficulty);
    setTyp(commonType);
  }, [commonCategory, commonType, commonDifficulty]);

  function nextQuestion() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prevIndex) => prevIndex + 1);
    }
  }

  function previousQuestion() {
    if (currentIndex > 0) {
      setCurrentIndex((curr) => curr - 1);
    }
  }

  function decodeHtml(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  }

  function handleAnswerSelection(selectedAnswer) {
    if (selectedAnswer === correctAnswer[currentIndex]) {
      setScore((prevScore) => prevScore + 1);
    }
    setAnsweredQuestions((prev) => [...prev, currentIndex]); // Mark the question as answered
  }

  function buttonCall() {
    alert('Button clicked!');

    fetch('http://localhost:8000/questions')
      .then((response) => response.json())
      .then((data) => {
        // Extract decoded question strings
        const questionTexts = data.map((item) => decodeHtml(item.question));
        const categories = data.map((item) => decodeHtml(item.category));
        const correctAnswers = data.map((item) => decodeHtml(item.correct_answer));
        const incorrectAnswers = data.map((item) => item.incorrect_answers.map(ans => decodeHtml(ans)));
        const types = data.map((item) => item.type);

        setQuestions(questionTexts);
        setCategory(categories);
        setAnswer(correctAnswers);
        setIncorrect(incorrectAnswers);
        setType(types);
        setCurrentIndex(0);
        console.log(data);
        setScore(0);
        setAnsweredQuestions([]);
      })
      .catch((error) => console.error('Error:', error));
  }

  function setCat(category_number){
    fetch(`http://localhost:8000/category?category_num=${category_number}`)
      .then((res) => res.json())
      .then((data) => console.log(data))
      .catch((err) => console.error(err));
  }
  function setDiff(difficultyLevel){
    fetch(`http://localhost:8000/difficulty?diff=${difficultyLevel}`)
    .then((res) => res.json())
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
  }
  function setTyp(questionType){
    fetch(`http://localhost:8000/type?type=${questionType}`)
    .then((res) => res.json())
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
  }
  function setCount(num){
    fetch(`http://localhost:8000/count?num=${num}`)
    .then((res) => res.json())
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
  }


  

  const [categoryMap, setCategoryMap] = useState({
    "Any Category": "all",
    "General Knowledge": 9,
    "Entertainment: Books": 10,
    "Entertainment: Film": 11,
    "Entertainment: Music": 12,
    "Entertainment: Musicals and Theaters": 13,
    "Entertainment: Television": 14,
    "Entertainment: Video Games": 15,
    "Entertainment: Board Games": 16,
    "Science & Nature" : 17,
    "Science: Computers" : 18,
    "Science: Mathematics" : 19,
    "Mythology" : 20,
    "Sports" : 21,
    "Geography" : 22,
    "History" : 23,
    "Politics" : 24,
    "Art" : 25,
    "Celebrities" : 26,
    "Animals"  : 27,
    "Vehicles" : 28,
    "Entertainment: Comics" : 29,
    "Science: Gadgets" : 30,
    "Entertainment: Japanese Anime & Manga": 31,
    "Entertainment: Cartoon & Animations" : 32
  })





//category, difficultyLevel, questionType should be drop down menus and should include all, which is the default
  return (
    <div className="App">
      <h1>Quiz App</h1>
      
      <input
        type="number"
        value={numQuestions}
        min="1"
        max="50"
        onChange={(e) => setNumQuestions(e.target.value)}
      />
      <button onClick={() => setCount(numQuestions)}>Set number of questions (1-50)</button>

      <button onClick={buttonCall}>Generate Questions</button>

      <select value={commonCategory} onChange={(e) => setCommonCategory(e.target.value)}>
        <option value="">Any Category</option>
        {Object.entries(categoryMap).map(([category, id]) => (
          <option key={id} value={id}>{category}</option>
        ))}
      </select>
      <select value={commonDifficulty} onChange={(e) => setCommonDifficulty(e.target.value)}>
        <option value="">Any Difficulty</option>
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>
      <select value={commonType} onChange={(e) => setCommonType(e.target.value)}>
        <option value="">Any Question Type</option>
        <option value="multiple">Multiple Choice</option>
        <option value="boolean">True/False</option>
      </select>

      {questions.length > 0 ? (
        <div style={{ marginTop: '20px' }}>

          Score: {score} / {questions.length}
          <p>
            <strong>Question {currentIndex + 1} of {questions.length}</strong>
            {category[currentIndex] && <span> ({category[currentIndex]})</span>}
          </p>
          <p>{questions[currentIndex]}</p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
            <button 
              onClick={previousQuestion} 
              disabled={currentIndex === 0}
            >
              Previous
            </button>

            <button 
              onClick={nextQuestion} 
              disabled={currentIndex >= questions.length - 1}
            >
              Next
            </button>
          </div>

          {/*If multiple choice, then have 4 buttons */}
          {type[currentIndex] === 'multiple' ? (
            

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
            <button
              onClick={() => handleAnswerSelection(currentOptions[0])}
              disabled = {answeredQuestions.includes(currentIndex)}
            >
              {currentOptions[0]}
              
            </button>

            <button
              onClick={() => handleAnswerSelection(currentOptions[1])}
              disabled = {answeredQuestions.includes(currentIndex)}
            >
              {currentOptions[1]}
              
            </button>

            <button
              onClick={() => handleAnswerSelection(currentOptions[2])}
              disabled = {answeredQuestions.includes(currentIndex)}
            >
              {currentOptions[2]}
              
            </button>

            <button
              onClick={() => handleAnswerSelection(currentOptions[3])}
              disabled = {answeredQuestions.includes(currentIndex)}
            >
              {currentOptions[3]}
              
            </button>
            
        
          </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
              <button
                onClick={() => handleAnswerSelection("True")}
                disabled = {answeredQuestions.includes(currentIndex)}
              >True</button>
              <button
                onClick={() => handleAnswerSelection("False")}
                disabled = {answeredQuestions.includes(currentIndex)}
              >False</button>
            </div>
          )}
        </div>
      ) : (
        <p style={{ marginTop: '20px' }}>Click "Generate Questions" to begin.</p>
      )}
    </div>
  );
}

export default App;