"""
Simulation 1
Mesa Solara visualization for the single roomba simulation model.
Diego Córdova Rodríguez, A01781166
2025-11-19
"""

from random_agents.agent import Roomba, ObstacleAgent, TrashAgent, Station, Ground
from random_agents.model import RandomModel

from mesa.visualization import (
    Slider,
    SolaraViz,
    make_plot_component,
    make_space_component,
)

from mesa.visualization.components import AgentPortrayalStyle

def random_portrayal(agent):
    if agent is None:
        return

    portrayal = AgentPortrayalStyle(
        size=50,
        marker="o",
    )

    if isinstance(agent, Roomba):
        portrayal.color = "blue"
        portrayal.marker = "o"
    elif isinstance(agent, Station):
        portrayal.color = "red"
        portrayal.marker = "v"
    elif isinstance(agent, ObstacleAgent):
        portrayal.color = "gray"
        portrayal.marker = "s"
    elif isinstance(agent, TrashAgent):
        portrayal.color = "green"
        portrayal.marker = "x"
    elif isinstance(agent, Ground):
        if agent.explored:
            portrayal.color = "lightgray"
        else:
            portrayal.color = "white"
        portrayal.marker = "s"
        portrayal.zorder = 0 # Z order for drawing at the bottom

    return portrayal

model_params = {
    "seed": {
        "type": "InputText",
        "value": 42,
        "label": "Random Seed",
    },
    "max_steps": {
        "type": "InputText",
        "value": 3000,
        "label": "Maximum Steps",
    },
    "width": Slider("Grid width", 28, 1, 50),
    "height": Slider("Grid height", 28, 1, 50),
    "rate_obstacles": Slider("Obstacle Rate", 0.1, 0, 0.9, 0.05),
    "rate_trash": Slider("Trash Rate", 0.2, 0, 0.9, 0.05),
}

# Create the model using the initial parameters from the settings
model = RandomModel(
    seed=model_params["seed"]["value"],
    max_steps=model_params["max_steps"]["value"],
    width=model_params["width"].value,
    height=model_params["height"].value,
    rate_obstacles=model_params["rate_obstacles"].value,
    rate_trash=model_params["rate_trash"].value,
)

# Set equal aspect ratio for the grid
def post_process(ax):
    ax.set_aspect("equal")

# Customize line plot legend
def post_process_lines(ax):
    ax.legend(loc="center left", bbox_to_anchor=(1, 0.9))

# Create line plot component to track data over time
lineplot_component = make_plot_component(
    {"Battery %": "tab:blue", "Trash Collected %": "tab:green", "Movements": "tab:orange", "Recharges": "tab:red"},
    post_process=post_process_lines,
)

# Create space component for the grid
space_component = make_space_component(
    random_portrayal,
    draw_grid = False,
    post_process=post_process
)

# Create Solara visualization page
page = SolaraViz(
    model,
    components=[space_component, lineplot_component],
    model_params=model_params,
    name="Roomba Simulation",
)