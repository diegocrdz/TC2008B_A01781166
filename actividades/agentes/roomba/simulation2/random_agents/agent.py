"""
Simulation 2
Agents for the multiple roombas simulation.
Diego Córdova Rodríguez, A01781166
2025-11-24
"""

from mesa.discrete_space import CellAgent, FixedAgent
from collections import deque # Utilized for finding nearest unvisited cell
import heapq # Utilized for A* algorithm

class Roomba(CellAgent):
    """
    Roomba agent. Represents a cleaning robot.

    Objective: Clean trash while managing battery life
    
    Attributes:
        unique_id: Agent's ID
        cell: Current cell of the agent
        stationCells: Set of coordinates of known stations
        state: Current state of the Roomba
        battery: Current battery level
        visited_cells: Set of coordinates of visited cells
        trash_known_cells: Set of coordinates of known trash cells
        pathToStation: List of coordinates forming the path to the station
        distance_to_station: Chebyshev distance to the station
        hasExchangedInfo: Boolean indicating if info has been exchanged recently
        exchange_timer: Timer for info exchange cooldown
        steps: Number of steps taken
        hasToRecharge: Boolean indicating if the Roomba needs to recharge
        cleaned_trash: Amount of trash cleaned
        recharges: Number of times the Roomba has recharged
    """
    def __init__(self, model, cell):
        """
        Creates a new random agent.
        Args:
            model: Model reference for the agent
            cell: Reference to its position within the grid
        """
        super().__init__(model)
        self.cell = cell
        self.stationCells = set([self.cell.coordinate]) # Known stations
        self.state = "idle"
        self.battery = 100
        self.visited_cells = set([self.cell.coordinate]) # Visited cells
        self.trash_known_cells = set() # Seen trash cells (not yet cleaned)
        self.pathToStation = []
        self.distance_to_station = 0
        self.hasExchangedInfo = False
        self.exchange_timer = 0
        self.steps = 0
        self.hasToRecharge = False
        self.cleaned_trash = 0
        self.recharges = 0
    
    def checkBattery(self):
        """Check battery level and decide next action."""
        # Recalculate distance to nearest station
        self.distanceToStation()

        # Margin for avoiding running out of battery
        step_margin = 20
        total_distance = self.distance_to_station + step_margin

        # If the battery is low, return
        if self.battery <= total_distance:
            self.hasToRecharge = True
            self.state = "returning"
        else:
            # Continue normal operation
            self.state = "ready"
    
    def checkStation(self):
        """Check if the station is still occupied."""

        # Look for stations in the neighborhood
        station_cell = next(
            (cell for cell in self.cell.neighborhood
            if any(isinstance(obj, Station) for obj in cell.agents)), None
        )

        # If found a station, check if occupied
        if station_cell:
            occupied = self.stationOccupied(station_cell)
            if not occupied:
                # Can move to station
                self.state = "move"
                return station_cell
            else:
                # Station occupied, wait
                self.state = "waiting"
        return None

    def checkTrash(self):
        """Check for trash in the current cell"""

        # Get trash agent in the current cell
        trash_cell = next(
            (obj for obj in self.cell.agents if isinstance(obj, TrashAgent)), None
        )

        # If returning, store trash cell for later cleaning
        if (self.state == "returning") and trash_cell:
            self.trash_known_cells.add(self.cell.coordinate)
            return
        
        # If there is trash, change state to cleaning
        if trash_cell:
            self.state = "cleaning"
        else:
            # If there is no trash, check obstacles to move elsewhere
            self.state = "checkObstacles"
        return trash_cell
    
    def checkObstacles(self):
        """Choose next cell prioritizing non-visited and obstacle-free cells."""

        # Select valid neighboring cells
        valid_neighbors = self.cell.neighborhood.select(
            lambda cell: not any(isinstance(obj, ObstacleAgent) for obj in cell.agents)
        )

        # Among valid neighbors, prefer those with trash
        trash_cells = valid_neighbors.select(
            lambda cell: any(isinstance(obj, TrashAgent) for obj in cell.agents)
        )

        # Get unvisited cells
        unvisited_cells = valid_neighbors.select(
            lambda cell: cell.coordinate not in self.visited_cells
        )

        # Look for stations in neighbors and add to known stations
        station_cells = valid_neighbors.select(
            lambda cell: any(isinstance(obj, Station) for obj in cell.agents)
        )

        for station_cell in station_cells:
            self.addStation(station_cell)

        # Priority: trash, trash known, unvisited, any valid
        if trash_cells:
            next_cell = trash_cells.select_random_cell()
        elif self.trash_known_cells:
            path = self.pathToNearestTrash()
            if len(path) > 0:
                next_coord = path[0]
                next_cell = self.model.grid[next_coord]
            else:
                # If no path found, choose any valid neighbor
                next_cell = valid_neighbors.select_random_cell()
        elif unvisited_cells:
            next_cell = unvisited_cells.select_random_cell()
        else:
            # Path to the nearest unvisited cell
            path = self.pathToNearestUnvisited()
                
            if len(path) > 0:
                next_coord = path[0]
                next_cell = self.model.grid[next_coord]
            else:
                # If all cells have been visited, choose any valid neighbor
                next_cell = valid_neighbors.select_random_cell()
        
        # Move to the selected cell
        self.state = "moving"
        return next_cell

    def checkRoomba(self, roomba_cell):
        """Check for roombas in neighboring cells to exchange information."""
        # Get cells with other roombas
        roomba_cells = roomba_cell.neighborhood.select(
            lambda cell: any(isinstance(obj, Roomba) 
            and obj != self for obj in cell.agents)
        )

        # Get the first roomba agent found in those cells
        roomba_agent = next(
            (obj for cell in roomba_cells for obj in cell.agents
            if isinstance(obj, Roomba) and obj != self), None
        )

        # If found a roomba and havent exchanged info recently, prepare to communicate
        if roomba_agent and not self.hasExchangedInfo:
            self.state = "communicating"
        else:
            # No roomba found or already exchanged info, check for trash
            self.state = "checkTrash"
        return roomba_agent

    def move(self, cell):
        """Move the Roomba to the specified cell."""

        # If the cell is a station and its occupied, wait
        if cell.coordinate in self.stationCells and self.hasToRecharge and self.stationOccupied(cell):
            self.state = "waiting"
            return

        # Move to the new cell
        self.cell = cell

        # Mark cell as visited
        self.visited_cells.add(cell.coordinate)
        self.steps += 1

        # Mark ground as explored
        ground_agent = next((agent for agent in cell.agents if isinstance(agent, Ground)), None)
        if ground_agent:
            ground_agent.explored = True
        
        # Check if reached station
        if self.cell.coordinate in self.stationCells and self.hasToRecharge:
            occupied = self.stationOccupied(self.cell)
            if not occupied:
                self.state = "recharging"
                self.pathToStation = []  # Clear path when arrived
            else:
                # If occupied, wait
                self.state = "waiting"
        else:
            # If the station is not reached, go back to idle
            self.state = "idle"
    
    def clean(self, trash_cell):
        """If possible, clean the trash in the current cell."""
        trash_cell.with_trash = False
        trash_cell.remove()
        self.cleaned_trash += 1
        self.state = "idle"
    
    def a_star(self, start, goal):
        """
        A* pathfinding algorithm adapted for the grid in the model

        This algorithm was adapted from the advanced algorithm class
        with Lizbeth Peralta.

        Made by:
        - Diego Córdova Rodríguez
        - Aquiba Yudah Benarroch
        - Lorena Estefanía Chewtat Torres
        """

        # Calculate Manhattan distance
        # We have to estimate heuristic using this distance
        # since it is not given from the model
        # Ref: https://www.geeksforgeeks.org/dsa/a-search-algorithm/
        def heuristic(a, b):
            return abs(a[0] - b[0]) + abs(a[1] - b[1])

        # Initialize variables
        grid = self.model.grid
        stack = [] # Stack of nodes to explore
        c_list = {}  # g values
        visited = set()  # visited nodes

        # Father vector to reconstruct path
        fathers = {}

        # Initialize stack with start node
        # Heap already sorts by smallest f value
        heapq.heappush(stack, (0, start))
        c_list[start] = 0

        # While the stack is not empty
        # Explore neighbors with lowest f value
        while len(stack) > 0:
            
            # Get node with lowest f value
            # This returns f, coordinate
            # but we only need coordinate, so we use _
            _, current = heapq.heappop(stack)

            # If the node hasnt been visited, process it
            if current not in visited:

                # Mark as visited
                visited.add(current)

                # If we reached the goal, finish
                if (current == goal):
                    break

                # Explore neighbors
                # Get valid neighbors (not obstacles)                
                valid_neighbors = grid[current].neighborhood.select(
                    lambda cell: not any(isinstance(a, ObstacleAgent) for a in cell.agents)
                )
                
                # For each valid neighbor, calculate costs and update structures
                for neighbor_cell in valid_neighbors:
                    neighbor = neighbor_cell.coordinate
                    actual_c = c_list[current] + 1 # Cost between nodes is 1

                    # If the new cost is lower, calculate f and add to stack
                    if (actual_c < c_list.get(neighbor, float('inf'))):
                        c_list[neighbor] = actual_c
                        fathers[neighbor] = current
                        f_value = actual_c + heuristic(neighbor, goal)

                        # Add to stack
                        heapq.heappush(stack, (f_value, neighbor))

        # Reconstruct path
        if goal in fathers:
            path = []
            current = goal
            while current != start:
                path.append(current)
                current = fathers[current]
            path.reverse()
            return path
        
        # If no path found, return empty list
        return []

    def getNextReturnMove(self):
        """Select next cell to move towards the station."""

        # If there is no calculated path, calculate it
        if not self.pathToStation:
            self.calculateReturn()

            if not self.pathToStation:
                # If still no path, dont move
                return None
        
        # Follow the path step by step
        if self.pathToStation:
            next_coord = self.pathToStation.pop(0) # Get first coordinate and remove it
            next_cell = self.model.grid[next_coord]
            self.state = "moving"
            return next_cell
        else:
            # If there is no path, stay idle
            self.state = "idle"
            return None

    def calculateReturn(self):
        """
        Calculate distance to all free known stations and calculate path to the nearest one.
        """
        # Get current position
        start = self.cell.coordinate

        # Calculate Chebyshev distances to all available stations
        available_stations = [
            coord for coord in self.stationCells
            if not self.stationOccupied(self.model.grid[coord])
        ]

        # If all stations are occupied, do nothing
        if not available_stations:
            self.state = "waiting"
            self.pathToStation = []
            return

        # Pick the nearest station
        nearest_station = self.distanceToStation(available_stations)

        # If no station found, wait
        if nearest_station is None:
            self.state = "waiting"
            self.pathToStation = []
            return

        # Calculate path to nearest station using A*
        path = self.a_star(start, nearest_station)
        
        # If a path is found, set it
        if path:
            self.pathToStation = path
        else:
            # If no path found, wait
            self.state = "waiting"
            self.pathToStation = []
    
    def recharge(self):
        """Recharge the Roomba's battery."""
        self.battery += 5

        # If battery is full, change state to idle
        if self.battery >= 100:
            self.battery = 100
            self.hasToRecharge = False
            self.recharges += 1
            self.state = "idle"
    
    def pathToNearestUnvisited(self):
        """
        Find the nearest unvisited cell to the roomba

        Similar to A*, but we stop when we find the first unvisited cell.
        Then the path to that cell is calculated using A*.
        """
        grid = self.model.grid
        start = self.cell.coordinate

        visited = set(start)
        # Instead of heap with A*, we use queue
        # To get first item inserted
        queue = deque([start])

        # While there are cells to explore
        while len(queue) > 0:
            # Get the next cell to explore
            current = queue.popleft()
            cell = grid[current]

            # If the cell is unvisited and reachable, calculate path
            if cell.coordinate not in self.visited_cells and not any(isinstance(a, ObstacleAgent) for a in cell.agents):
                return self.a_star(start, cell.coordinate)

            # Otherwise, get neeighbors and explore them
            valid_neighbors = cell.neighborhood.select(
                lambda cell: not any(isinstance(a, ObstacleAgent) for a in cell.agents)
            )

            # For each neighbor, add to queue if unvisited
            for neighbor_cell in valid_neighbors:
                neighbor = neighbor_cell.coordinate
                if (neighbor) not in visited:
                    queue.append(neighbor)
                    visited.add(neighbor)

        # If no unvisited cell found, return empty path
        return []

    def pathToNearestTrash(self):
        """From trash cellls listed, find the nearest one and return path to it."""
        # Take the last trash cell added (closest one)
        trash_cell = self.trash_known_cells.pop()

        # Return path to that trash cell
        return self.a_star(self.cell.coordinate, trash_cell)

    def distanceToStation(self, stations=None):
        """Using ChebyShev, calculate smallest distance to known stations and return the nearest station cell."""

        # If no stations provided, use all known stations
        if stations is None:
            stations = self.stationCells
        
        # If no known stations, return None
        if not stations:
            self.distance_to_station = float('inf')
            return None

        # Variables to track nearest station
        min_distance = float('inf')
        nearest_station = None
        current_x, current_y = self.cell.coordinate

        # Find the nearest known station
        for coord in stations:
            base_x, base_y = coord
            distance = max(abs(current_x - base_x), abs(current_y - base_y))

            # Update nearest station if closer
            if distance < min_distance:
                min_distance = distance
                nearest_station = coord

        # Set the distance to the nearest station
        self.distance_to_station = min_distance
        return nearest_station

    def exchangeInfo(self, other_roomba):
        """Update the set of visited cells and known stations with the ones the other roomba has."""

        # Update visited cells
        for cell in other_roomba.visited_cells:
            if cell not in self.visited_cells:
                self.visited_cells.add(cell)
        
        # Update known stations
        for station_coord in other_roomba.stationCells:
            if station_coord not in self.stationCells:
                self.stationCells.add(station_coord)
        
        # Set timer to avoid multiple exchanges in short time
        self.hasExchangedInfo = True
        self.exchange_timer = 10  # Steps before allowing new exchanges
        self.state = "idle"
    
    def addStation(self, station_cell):
        """Add a new station cell to the known stations."""

        # If not already known, add it
        if station_cell.coordinate not in self.stationCells:
            self.stationCells.add(station_cell.coordinate)
    
    def stationOccupied(self, station_cell):
        """Check if a station cell is occupied by another recharging roomba."""

        # If any roomba in the cell is recharging, the station is occupied
        occupied = any(
            isinstance(agent, Roomba) and agent is not self and agent.state == "recharging"
            for agent in station_cell.agents
        )

        return occupied

    def step(self):
        """
        Execute one step of the Roomba's behavior based on the state machine.
        """

        # Initial state checks
        if self.state == "idle":
            self.checkBattery()
        elif self.state == "waiting":
            next_cell = self.checkStation()
            if next_cell and self.state == "move":
                self.move(next_cell)
        
        # After initial checks, perform actions based on state
        if self.state == "returning":
            self.checkTrash()
            next_cell = self.getNextReturnMove()
            if next_cell and self.state == "moving":
                self.move(next_cell)
        elif self.state == "recharging":
            self.recharge()
        elif self.state == "ready":
            roomba_agent = self.checkRoomba(self.cell)
            if self.state == "communicating":
                self.exchangeInfo(roomba_agent)
            elif self.state == "checkTrash":
                trash_cell = self.checkTrash()
                if self.state == "cleaning":
                    self.clean(trash_cell)
                elif self.state == "checkObstacles":
                    next_cell = self.checkObstacles()
                    if self.state == "moving":
                        self.move(next_cell)
        
        # Handle exchange timer
        if self.exchange_timer > 0:
            self.exchange_timer -= 1
            if self.exchange_timer == 0:
                self.hasExchangedInfo = False
        
        # Always decrease battery by 1 at the end of the step
        # except when recharging or waiting
        if self.state not in ["recharging", "waiting"]:
            self.battery -= 1
        
        # If battery reaches 0, remove the agent
        if self.battery <= 0:
            self.remove()

class TrashAgent(FixedAgent):
    """
    Trash agent. Represents trash that can be cleaned by roombas.

    Attributes:
        with_trash: Boolean indicating if the trash is present
    """
    @property
    def with_trash(self):
        """Whether the cell has trash."""
        return self._with_trash
    
    @with_trash.setter
    def with_trash(self, value: bool) -> None:
        """Set trash presence state."""
        self._with_trash = value

    def __init__(self, model, cell):
        """Create a new trash object

        Args:
            model: Model instance
            cell: Cell to which this trash object belongs
        """
        super().__init__(model)
        self.cell=cell
        self._with_trash = True

class Station(FixedAgent):
    """
    Station agent. Just to add charging stations to the grid.
    """
    def __init__(self, model, cell):
        super().__init__(model)
        self.cell=cell

    def step(self):
        pass

class ObstacleAgent(FixedAgent):
    """
    Obstacle agent. Just to add obstacles to the grid.
    """
    def __init__(self, model, cell):
        super().__init__(model)
        self.cell=cell

    def step(self):
        pass

class Ground(FixedAgent):
    """
    Ground agent. Represents ground cells in the grid.

    Attributes:
        explored: Boolean indicating if the cell has been explored
    """
    @property
    def explored(self):
        """Whether the cell has been explored."""
        return self._explored

    @explored.setter
    def explored(self, value: bool) -> None:
        """Set explored state."""
        self._explored = value

    def __init__(self, model, cell):
        """Create a new ground object

        Args:
            model: Model instance
            cell: Cell to which this ground object belongs
        """
        super().__init__(model)
        self.cell=cell
        self._explored = False