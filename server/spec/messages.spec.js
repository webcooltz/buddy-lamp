// const { describe, it, expect } = require('@jest/globals');
// const request = require('supertest');
// const app = require('../index');
// const port = 3000;
// const messageController = require('../controllers/message');

// const getCurrentColor = require('./message'); // Import the function to be tested

// describe('getCurrentColor', () => {
//   // Test case for no messages
//   it('should return white when no messages are found', (done) => {
//     const req = {}; // Mock request object
//     const res = {
//       status: (code) => {
//         expect(code).toEqual(200); // Expect status code 200
//         return {
//           json: (data) => {
//             expect(data.color).toEqual('white'); // Expect color to be white
//             done(); // Signal test completion
//           }
//         };
//       }
//     };

//     getCurrentColor(req, res);
//   });

//   // Test case for messages with last color
//   it('should return the last color from messages', (done) => {
//     const messages = [
//       { color: 'red' },
//       { color: 'green' },
//       { color: 'blue' }
//     ];
//     const req = {}; // Mock request object
//     const res = {
//       status: (code) => {
//         expect(code).toEqual(200); // Expect status code 200
//         return {
//           json: (data) => {
//             expect(data.color).toEqual('blue'); // Expect color to be blue
//             done(); // Signal test completion
//           }
//         };
//       }
//     };

//     spyOn(global, 'readMessages').and.returnValue(Promise.resolve(messages)); // Mock readMessages function

//     getCurrentColor(req, res);
//   });

//   // Test case for error retrieving messages
//   it('should return 500 status with error message on failure', (done) => {
//     const req = {}; // Mock request object
//     const res = {
//       status: (code) => {
//         expect(code).toEqual(500); // Expect status code 500
//         return {
//           json: (data) => {
//             expect(data.message).toEqual('Failed to retrieve color'); // Expect error message
//             done(); // Signal test completion
//           }
//         };
//       }
//     };

//     spyOn(global, 'readMessages').and.returnValue(Promise.reject('Error retrieving messages')); // Mock readMessages function

//     getCurrentColor(req, res);
//   });
// });


// describe('Message tests', () => {
//     const mockHousehold = {
//         name: "Smith",
//         color: "red"
//     };
//     // let messageId;
//     // let date;

//     beforeAll(async () => {
//         await app.listen(port);
//     });

//     // GET /messages response
//     // *not working*
//     it('route should respond with status 200', (done) => {
//         request(app)
//             .get('/messages')
//             .expect(200)
//             .end((err, res) => { 
//             if (err) return done.fail(err);
//             done();
//         });
//     });

//     // POST new message
//     // *not working*
//     it('should create a new student', async () => {
//         const mockReq = {
//             body: {
//                 household: mockHousehold,
//             }
//         };
//         const mockRes = {
//             status: (statusCode) => ({
//                 json: (data) => {
//                     mockRes.statusCode = statusCode;
//                     mockRes.data = data;
//                     return mockRes;
//                 },
//             })
//         };
    
//         await messageController.createStudent(mockReq, mockRes);
//         // newStudentId = mockRes.data.student._id;
    
//         expect(mockRes.data.message).toBe("Created new student successfully.");
//         expect(mockRes.statusCode).toBe(201);
//         expect(mockRes.data.student.firstName).toBe('Johnny');
//         expect(mockRes.data.student.lastName).toBe('Baker');
//         expect(mockRes.data.student.email).toBe('johnny.baker@example.edu');
//         expect(mockRes.data.student.creditHours).toBe(61);
//     }, 10000);

//     // *working*
//     it('mongoose validation error', async () => {
//         // empty body
//         const mockReq = {
//             body: {}
//         };
//         const mockRes = {
//             status: (statusCode) => ({
//                 json: (data) => {
//                     mockRes.statusCode = statusCode;
//                     mockRes.data = data;
//                     return mockRes;
//                 },
//             })
//         };
    
//         await messageController.createStudent(mockReq, mockRes);
    
//         expect(mockRes.data.message).toBe("Student validation failed: firstName: Path `firstName` is required., lastName: Path `lastName` is required., email: Path `email` is required.");
//         expect(mockRes.statusCode).toBe(400);
//     }, 10000);

//     // PUT update new student
//     // *working*
//     it('should update the new student', async () => {
//         if (newStudentId) {
//             studentId = newStudentId;
//         } else {
//             console.log("PUT student - newStudentId error");
//             return;
//         }
//         const altStudent = {
//             firstName: "John",
//             lastName: "BGood",
//             email: "johnny.bgood@example.edu",
//             creditHours: 70
//         };
//         const mockPutReq = {
//             params: {
//                 id: studentId
//             },
//             body: {
//                 firstName: altStudent.firstName,
//                 lastName: altStudent.lastName,
//                 email: altStudent.email,
//                 creditHours: altStudent.creditHours
//             }
//         };
//         const mockPutRes = {
//             status: (statusCode) => ({
//                 json: (data) => {
//                     mockPutRes.statusCode = statusCode;
//                     mockPutRes.data = data;
//                     return mockPutRes;
//                 },
//               })
//         };
    
//         await messageController.updateStudent(mockPutReq, mockPutRes);
    
//         expect(mockPutRes.data.message).toBe("Updated student successfully.");
//         expect(mockPutRes.statusCode).toBe(204);
//         expect(mockPutRes.data.student.firstName).toBe('John');
//         expect(mockPutRes.data.student.lastName).toBe('BGood');
//         expect(mockPutRes.data.student.email).toBe('johnny.bgood@example.edu');
//         expect(mockPutRes.data.student.creditHours).toBe(70);
//     }, 10000);

//     // DELETE 1 student
//     // *working*
//     it('should delete 1 student', async () => {
//         if (newStudentId) {
//             studentId = newStudentId;
//         } else {
//             console.log("Deletion error. newStudentId failed.");
//             return;
//         }
//         const mockDeleteReq = {
//             params: {
//               id: studentId
//             }
//           };
//         const mockDeleteRes = {
//             status: (statusCode) => ({
//                 json: (data) => {
//                     mockDeleteRes.statusCode = statusCode;
//                     mockDeleteRes.data = data;
//                     return mockDeleteRes;
//                 },
//             })
//         };

//         await messageController.deleteStudent(mockDeleteReq, mockDeleteRes);

//         expect(mockDeleteRes.statusCode).toBe(200);
//         expect(mockDeleteRes.data.message).toBe("Deleted student successfully.");
//     }, 10000);
// });