import React, {useContext, useEffect, useState} from 'react';
import Editor from './Editor';
import {Checkbox} from 'react-bootstrap';
import TopNavBarTeam from './TopNavBarTeam';
import {TeamContext} from "./App";
import QuestionAreaTeam from "./QuestionAreaTeam";
import {getEventQuestions} from "../api/EventQuestionApi";
import {getQuestions} from "../api/QuestionApi";
import {getEventGroups} from "../api/EventGroupApi";
import {getGroupUsers} from "../api/GroupUserApi";
import {getUserById} from "../api/UserApi";
import {
    addEventGroupUserQuestionHandle,
    getEventGroupUserQuestionHandle,
    putEventGroupUserQuestionHandle
} from "../api/GroupQuestionHandleApi";

function QuestionRowTeam() {
    const storedUser = JSON.parse(localStorage.getItem('loginUser'));
    const loginUser = storedUser || null;
    const [eventQuestionList, setEventQuestionList] = useState([]);
    const selectedEventId = sessionStorage.getItem('selectedEventId');
    const questionIdMapString = sessionStorage.getItem('color');
    const questionIdMap = JSON.parse(questionIdMapString);

    const [team, setTeam] = useState([])

    const teamColors = {};
    const colorArray = ['red', 'blue', 'green', 'purple', 'orange', 'pink'];

    team.forEach((member, index) => {
        teamColors[member.id] = colorArray[index % colorArray.length];
    });

    const [focusedIndex, setFocusedIndex] = useState(null);
    const [userGroupIds, setUserGroupIds] = useState([]);



    const getEventGroupUserList = async () => {
        try {
            const response = await getEventGroups(loginUser.accessToken);
            const eventGroups = response.data;
            console.log(eventGroups);

            const selectedEventGroups = eventGroups.filter(group => group.eventid === parseInt(selectedEventId, 10));
            console.log("Selected Event ID:", parseInt(selectedEventId, 10));
            console.log("Filtered groups:", selectedEventGroups);

            const groupUserData = await getGroupUsers(loginUser.accessToken);
            const groupUsers = groupUserData.data;
            console.log("groupUsers:", groupUsers);

            // Find the group IDs where loginUser is a member
            const userGroupIds = groupUsers
                .filter(user => user.userid === loginUser.id)
                .map(user => user.groupid);
            console.log("userGroupIds:", userGroupIds);

            setUserGroupIds(userGroupIds);

            // Filter selectedEventGroups based on the user's group membership
            const userEventGroups = selectedEventGroups.filter(group => userGroupIds.includes(group.groupid));
            console.log("userEventGroups:", userEventGroups);


            // Get all users in the userEventGroups
            const userEventGroupUsers = groupUsers
                .filter(user => userEventGroups.some(group => group.groupid === user.groupid))
                .map(user => ({
                    userid: user.userid,
                }));

            console.log("Users in user's groups:", userEventGroupUsers);

            const updatedTeam = [];
            for (const user of userEventGroupUsers) {
                try {
                    const userDetails = await getUserById(loginUser.accessToken, user.userid);
                    const userToAdd = userDetails.data;
                    //       // Assuming 'team' is a state variable, you need to use setTeam to update it
                    updatedTeam.push(userToAdd);
                    console.log(updatedTeam)
                } catch (error) {
                    console.error('Failed to get user details:', error);
                }
            }
            setTeam(updatedTeam);
            console.log(team);

        } catch (error) {
            console.error('Failed to get event group users:', error);
        }
    };

    const getEventQuestionList = async () => {
        try {
            const response = await getEventQuestions(loginUser.accessToken);
            const eventQuestions = response.data;
            const selectedEventQuestions = eventQuestions.filter(question => question.eventid === parseInt(selectedEventId, 10));
            console.log(selectedEventQuestions)
            const questionIds = selectedEventQuestions.map((question) => question.questionid);
            const questionData = await getQuestions(loginUser.accessToken);
            const questionList = questionData.data;
            console.log("questionList:", questionList);
            console.log("questionIds:", questionIds);
            const filteredQuestions = questionList.filter((question) => questionIds.includes(question.id));
            console.log("filteredQuestions:", filteredQuestions);
            setEventQuestionList(filteredQuestions);
        } catch (error) {
            console.error('Failed to get questions:', error);
        }
    };

    const getEventGroupUserQuestionHandleList = async () => {
        try {
            const response = await getEventGroupUserQuestionHandle(loginUser.accessToken);
            const data = response.data;

            // 将数据处理为以questionid为键的对象，值为userlist.id
            const questionIdMap = {};
            data.forEach(item => {
                const questionId = item.questionid;
                const userlistId = item.userlist;
                questionIdMap[questionId] = userlistId;
            });

            // 保存映射到sessionStorage
            sessionStorage.setItem('color', JSON.stringify(questionIdMap));
            console.log(questionIdMap);
            // 在这里处理数据，可能设置到 state 中，方便后续渲染时使用
        } catch (error) {
            console.error('Failed to save response:', error);
        }
    };


    useEffect(() => {
        if (loginUser) {
            getEventGroupUserList();
            getEventQuestionList();
            getEventGroupUserQuestionHandleList();
        }

        const intervalId = setInterval(() => {
            getEventGroupUserList();
            getEventQuestionList();
            getEventGroupUserQuestionHandleList();
        }, 2000);

        // 在组件卸载时清除定时器，防止内存泄漏
        return () => clearInterval(intervalId);
    }, []);


    const handleColorChange = async (index) => {
        setFocusedIndex(index);

        if (team.length > 0) {
            // Assuming 'eventQuestionList' and 'team' have the same length
            const question = eventQuestionList[index];


            // Save the user's response to the question
            await handleSaveResponse(question);


        }
    };

    const handleSaveResponse = async (question) => {
        try {
            // await createEventGroupUserQuestionHandle(question, user);
            // Check if there is an existing record with the same eventid, questionid, and groupid
            const existingRecord = await checkExistingRecord(question.id, userGroupIds[0]);

            if (existingRecord) {
                // If exists, update user.id for the existing record
                await updateEventGroupUserQuestionHandle(existingRecord.id, question);
            } else {
                // If not exists, create a new record
                await createEventGroupUserQuestionHandle(question);
            }

            console.log('Response saved successfully');
        } catch (error) {
            console.error('Failed to save response:', error);
        }
    };

    const checkExistingRecord = async (questionId, groupId) => {
        try {
            const response = await getEventGroupUserQuestionHandle(loginUser.accessToken);
            const questionHandles = response.data;
            return questionHandles.find(handle =>
                handle.eventid === parseInt(selectedEventId, 10) &&
                handle.questionid === questionId &&
                handle.groupid === groupId
            );
        } catch (error) {
            console.error('Failed to check existing record:', error);
            throw error;
        }
    };

    const updateEventGroupUserQuestionHandle = async (recordId,question) => {
        try {
            // Call the API to update the existing record with the new user.id
            const questionData = {
                eventid: parseInt(selectedEventId, 10),
                questionid: question.id,
                groupid: userGroupIds[0],
                userlist: loginUser.id,
                response: question.response,
            };
            const updatedResponse = await putEventGroupUserQuestionHandle(loginUser.accessToken, recordId, questionData);
            console.log('Record updated:', updatedResponse.data);
        } catch (error) {
            console.error('Failed to update record:', error);
            throw error;
        }
    };

    const createEventGroupUserQuestionHandle = async (question) => {
        try {
            // Prepare the questionData object with necessary information
            const questionData = {
                eventid: parseInt(selectedEventId, 10),
                questionid: question.id,
                groupid: userGroupIds[0],
                userlist: loginUser.id,
                response: question.response,
            };

            // Call the API to create a new record
            const response = await addEventGroupUserQuestionHandle(loginUser.accessToken, questionData);
            console.log('New record created:', response.data);
        } catch (error) {
            console.error('Failed to create new record:', error);
            throw error;
        }
    };

    return (
        <>
            <TopNavBarTeam/>
            {Array.isArray(eventQuestionList) && eventQuestionList.map((question, index) => (
                <div
                    style={{
                        display: 'flex',
                        marginBottom: '100px',
                        marginLeft: '20px',
                    }}>

                    <div
                        style={{
                            marginLeft: '20px'
                        }}>
                        {questionIdMap && questionIdMap[question.id] ? (
                            <QuestionAreaTeam
                                question={question}
                                borderColor={focusedIndex === index ? teamColors[questionIdMap[question.id]] : teamColors[questionIdMap[question.id]]}
                            />
                        ) : (
                            <QuestionAreaTeam
                                question={question}
                                borderColor={focusedIndex === index ? teamColors[loginUser.id] : 'transparent'}
                            />
                        )}
                    </div>
                    <div>
                        <Editor
                            checked={focusedIndex === index}
                            handleColorChange={() => handleColorChange(index)}
                        />
                    </div>

                </div>


            ))}
        </>
    );
}

export default QuestionRowTeam;