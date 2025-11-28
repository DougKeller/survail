#!/usr/bin/env python3
"""
Basic LangGraph application with Azure OpenAI and LangSmith tracing.

This app demonstrates:
- LangGraph state management with Postgres checkpointer
- Azure OpenAI integration using deployment configurations
- LangSmith tracing for observability
"""

from typing import Annotated, Literal
from typing_extensions import TypedDict

from langchain_openai import AzureChatOpenAI
from langchain_core.messages import AnyMessage, HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver

from config.config import ConfigError

try:
    from config.config import (
        AZURE_OPENAI_API_KEY,
        AZURE_OPENAI_API_VERSION,
        DATABASE_URL,
        LANGSMITH_API_KEY,
        is_langsmith_enabled,
    )
    from config.deployments import get_deployment
except ConfigError as e:
    print(f"❌ Configuration Error: {e}")
    print("\nPlease set all required environment variables in your .env file:")
    print("  - AZURE_OPENAI_API_KEY")
    print("  - DATABASE_URL")
    print("  - AZURE_OPENAI_API_VERSION")
    exit(1)


# Define the state schema
class AgentState(TypedDict):
    """State schema for the agent."""
    messages: Annotated[list[AnyMessage], "append"]


def create_llm(deployment_name: str = "gpt-5.1") -> AzureChatOpenAI:
    """
    Create and configure Azure OpenAI LLM using deployment configuration.
    
    Args:
        deployment_name: Name of the deployment to use (default: "gpt-5.1")
        
    Returns:
        Configured AzureChatOpenAI instance
    """
    # Get deployment configuration
    deployment = get_deployment(deployment_name)
    
    return AzureChatOpenAI(
        azure_deployment=deployment.deployment,
        azure_endpoint=deployment.endpoint,
        api_key=AZURE_OPENAI_API_KEY,
        api_version=AZURE_OPENAI_API_VERSION,
        temperature=0.7,
    )


def agent_node(state: AgentState) -> AgentState:
    """Agent node that processes messages and generates responses."""
    # Use GPT 5.1 deployment by default
    llm = create_llm("gpt-5.1")
    
    # Get messages from state
    messages = state["messages"]
    
    # Add system message if not present
    if not messages or not isinstance(messages[0], SystemMessage):
        system_msg = SystemMessage(
            content="You are a helpful assistant. Provide clear and concise answers."
        )
        messages = [system_msg] + messages
    
    # Invoke LLM
    response = llm.invoke(messages)
    
    return {"messages": [response]}


def should_continue(state: AgentState) -> Literal[END]:
    """Determine if the graph should continue or end."""
    # For this simple example, we always end after one response
    return END


def create_graph(checkpointer: PostgresSaver):
    """
    Create and compile the LangGraph agent with Postgres checkpointer.
    
    Args:
        checkpointer: PostgresSaver instance (must be from context manager)
        
    Returns:
        Compiled LangGraph application
    """
    # Build the graph
    workflow = StateGraph(AgentState)
    
    # Add the agent node
    workflow.add_node("agent", agent_node)
    
    # Set entry point
    workflow.add_edge(START, "agent")
    
    # Add conditional edge to end
    workflow.add_conditional_edges("agent", should_continue)
    
    # Compile with checkpointer
    app = workflow.compile(checkpointer=checkpointer)
    
    return app


def main():
    """Main function to run the agent."""
    # Configuration is loaded and validated at import time
    # If any required variables are missing, ConfigError will be raised during import
    
    # Display configuration status
    print(f"Database: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else DATABASE_URL}")
    
    # Check for LangSmith configuration
    if is_langsmith_enabled():
        print("✓ LangSmith tracing enabled")
    else:
        if LANGSMITH_API_KEY:
            print("⚠ LangSmith API key set but tracing not enabled")
            print("  Note: Set LANGSMITH_TRACING=true to enable tracing")
        else:
            print("⚠ LangSmith API key not set - tracing disabled")
    
    # Create Postgres checkpointer and run application within context
    print("\nCreating LangGraph agent with Postgres checkpointer...")
    try:
        with PostgresSaver.from_conn_string(DATABASE_URL) as checkpointer:
            # Setup database tables (only needed on first run)
            try:
                checkpointer.setup()
                print("✓ Postgres checkpointer initialized")
            except Exception as e:
                print(f"⚠ Warning: Could not setup checkpointer tables: {e}")
                print("  Tables may already exist, continuing...")
            
            # Create the graph with checkpointer
            app = create_graph(checkpointer)
            
            # Example conversation
            print("\n" + "="*50)
            print("Starting conversation with the agent")
            print("="*50 + "\n")
            
            # Create a thread for conversation persistence
            thread_id = {"configurable": {"thread_id": "1"}}
            
            # First message
            user_message = HumanMessage(content="Hello! Can you tell me a fun fact about space?")
            print(f"User: {user_message.content}\n")
            
            try:
                result = app.invoke(
                    {"messages": [user_message]},
                    thread_id
                )
                
                # Print the response
                last_message = result["messages"][-1]
                print(f"Assistant: {last_message.content}\n")
                
                # Second message (demonstrating conversation continuity)
                user_message2 = HumanMessage(content="Tell me another one!")
                print(f"User: {user_message2.content}\n")
                
                result2 = app.invoke(
                    {"messages": [user_message2]},
                    thread_id
                )
                
                last_message2 = result2["messages"][-1]
                print(f"Assistant: {last_message2.content}\n")
                
                print("="*50)
                print("Conversation complete!")
                print("="*50)
            except Exception as e:
                print(f"\n❌ Error during conversation: {e}")
                print("\nMake sure:")
                print("  1. Postgres is running (docker-compose up -d)")
                print("  2. Database connection string is correct")
                print("  3. Azure OpenAI credentials are set in .env")
    except Exception as e:
        print(f"\n❌ Error creating checkpointer: {e}")
        print("\nMake sure Postgres is running:")
        print("  docker-compose up -d")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
