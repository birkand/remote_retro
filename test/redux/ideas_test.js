import deepFreeze from "deep-freeze"
import sinon from "sinon"

import { setupMockPhoenixChannel } from "../support/js/test_helper"
import {
  actions as actionCreators,
  reducer as ideasReducer
} from "../../web/static/js/redux/ideas"

describe("idea reducer", () => {
  describe("when an action is nonexistent or unhandled", () => {
    describe("and there is no initial state", () => {
      it("should return an empty array", () => {
        const unhandledAction = { type: "IHAVENOIDEAWHATSHAPPENING" }

        expect(ideasReducer(undefined, {})).to.deep.equal([])
        expect(ideasReducer(undefined, unhandledAction)).to.deep.equal([])
      })
    })

    describe("and there is initial state", () => {
      it("should return that initial state", () => {
        const initialState = [{ body: "we have a linter!", category: "happy", user_id: 1 }]
        const unhandledAction = { type: "IHAVENOIDEAWHATSHAPPENING" }

        expect(ideasReducer(initialState, {})).to.deep.equal(initialState)
        expect(ideasReducer(initialState, unhandledAction)).to.deep.equal(initialState)
      })
    })
  })

  describe("the handled actions", () => {
    describe("when the action is IDEA_SUBMISSION_COMMITTED", () => {
      it("should add an idea to list of ideas", () => {
        const initialState = [{ body: "i'm an old idea!", category: "happy", user_id: 2 }]
        deepFreeze(initialState)
        const idea = { body: "we have a linter!", category: "happy", user_id: 1 }
        const action = { type: "IDEA_SUBMISSION_COMMITTED", idea }

        expect(ideasReducer(initialState, action)).to.deep.equal([...initialState, idea])
      })
    })

    describe("when the action is SET_INITIAL_STATE", () => {
      it("should replace the state with the ideas passed in the action's inialState object", () => {
        const initialIdeas = [{ body: "i'm an old idea!", category: "happy", user_id: 2 }]
        deepFreeze(initialIdeas)

        const newIdeas = [{ body: "modern convenience", category: "confused", user_id: 1 }]
        const action = { type: "SET_INITIAL_STATE", initialState: { ideas: newIdeas } }

        expect(ideasReducer(initialIdeas, action)).to.deep.equal([...newIdeas])
      })
    })

    describe("when the action is UPDATE_IDEA", () => {
      const initialIdeas = [{ id: 666, category: "happy", user_id: 1 }, { id: 22, category: "n/a", user_id: 2 }]
      deepFreeze(initialIdeas)

      it("returns an updated set of ideas, where the idea with matching id has updated attributes", () => {
        const action = { type: "UPDATE_IDEA", ideaId: 666, newAttributes: { category: "sad" } }
        expect(ideasReducer(initialIdeas, action)).to.deep.equal([
          { id: 666, category: "sad", user_id: 1 },
          { id: 22, category: "n/a", user_id: 2 },
        ])
      })
    })

    describe("when the action is IDEA_DELETION_COMMITTED", () => {
      const initialIdeas = [{ id: 667, category: "happy", user_id: 1 }, { id: 22, category: "n/a", user_id: 2 }]
      deepFreeze(initialIdeas)

      it("returns an updated set of ideas, where the idea with matching id has been removed", () => {
        const action = { type: "IDEA_DELETION_COMMITTED", ideaId: 667 }
        expect(ideasReducer(initialIdeas, action)).to.deep.equal([
          { id: 22, category: "n/a", user_id: 2 },
        ])
      })
    })

    describe("when the action is IDEA_DELETION_REJECTED", () => {
      const initialIdeas = [
        { id: 667, category: "happy", user_id: 1 },
        { id: 22, category: "n/a", user_id: 2, deletionSubmitted: true },
      ]
      deepFreeze(initialIdeas)

      it("returns an updated set of ideas, where the idea's no longer flagged as submitted for deletion", () => {
        const action = { type: "IDEA_DELETION_REJECTED", ideaId: 22 }
        expect(ideasReducer(initialIdeas, action)).to.deep.equal([
          { id: 667, category: "happy", user_id: 1 },
          { id: 22, category: "n/a", user_id: 2, deletionSubmitted: false },
        ])
      })
    })
  })
})

describe("actionCreators", () => {
  describe("addIdea", () => {
    it("creates an action to add idea to store", () => {
      const idea = { body: "we have a linter!", category: "happy", user_id: 1 }

      expect(actionCreators.addIdea(idea)).to.deep.equal({ type: "IDEA_SUBMISSION_COMMITTED", idea })
    })
  })

  describe("submitIdea", () => {
    const idea = { body: "we have a linter!", category: "happy", user_id: 1 }

    it("returns a thunk", () => {
      const result = actionCreators.submitIdea(idea)
      expect(result).to.be.a("function")
    })

    describe("invoking the returned function", () => {
      let thunk
      let mockRetroChannel

      beforeEach(() => {
        thunk = actionCreators.submitIdea(idea)
        mockRetroChannel = setupMockPhoenixChannel()
        sinon.spy(mockRetroChannel, "push")
      })

      afterEach(() => {
        mockRetroChannel.push.restore()
      })

      it("results in a push to the retroChannel", () => {
        thunk(undefined, undefined, mockRetroChannel)
        expect(mockRetroChannel.push.calledWith("idea_submitted", idea)).to.eq(true)
      })

      describe("when the push results in an error", () => {
        let push

        it("dispatches an error", () => {
          push = mockRetroChannel.push("anyEventJustNeedThePushInstance", { foo: "bar" })
          const dispatchSpy = sinon.spy()
          thunk(dispatchSpy, undefined, mockRetroChannel)

          push.trigger("error", {})

          expect(
            dispatchSpy.calledWithMatch({ type: "IDEA_SUBMISSION_REJECTED" })
          ).to.eq(true)
        })
      })
    })
  })

  describe("updateIdea", () => {
    it("creates an action to update an idea with particular id with new attributes", () => {
      const ideaId = 999
      const newAttributes = { name: "Kimberly" }

      expect(actionCreators.updateIdea(ideaId, newAttributes)).to.deep.equal({
        type: "UPDATE_IDEA",
        ideaId,
        newAttributes,
      })
    })
  })

  describe("deleteIdea", () => {
    it("creates an action to delete an idea with particular id", () => {
      const ideaId = 999

      expect(actionCreators.deleteIdea(ideaId)).to.deep.equal({
        type: "IDEA_DELETION_COMMITTED",
        ideaId,
      })
    })
  })

  describe("submitIdeaDeletion", () => {
    let thunk
    let mockRetroChannel

    const ideaId = 999

    beforeEach(() => {
      thunk = actionCreators.submitIdeaDeletion(ideaId)
      mockRetroChannel = setupMockPhoenixChannel()
    })

    it("returns a thunk", () => {
      expect(typeof thunk).to.equal("function")
    })

    describe("the thunk", () => {
      const thunk = actionCreators.submitIdeaDeletion(ideaId)
      const dispatchStub = () => {}
      const getStateStub = () => {}

      it("pushes a idea_deleted event to the retro channel", () => {
        sinon.spy(mockRetroChannel, "push")

        thunk(dispatchStub, getStateStub, mockRetroChannel)

        expect(
          mockRetroChannel.push.calledWith("idea_deleted", 999)
        ).to.equal(true)

        mockRetroChannel.push.restore()
      })

      describe("when the push results in an error", () => {
        let push

        it("dispatches an error", () => {
          push = mockRetroChannel.push("anyEventJustNeedThePushInstance", { foo: "bar" })
          const dispatchSpy = sinon.spy()
          thunk(dispatchSpy, undefined, mockRetroChannel)

          push.trigger("error", {})

          expect(
            dispatchSpy.calledWith({ type: "IDEA_DELETION_REJECTED", ideaId: 999 })
          ).to.eq(true)
        })
      })

      it("notifies the store that the idea has been submitted for deletion", () => {
        const dispatchSpy = sinon.spy()
        thunk(dispatchSpy, getStateStub, mockRetroChannel)

        expect(
          dispatchSpy.calledWith({
            type: "UPDATE_IDEA",
            ideaId: 999,
            newAttributes: { deletionSubmitted: true },
          })
        ).to.equal(true)
      })
    })
  })
})
