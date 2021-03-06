package au.csiro.data61.magda.registry

import java.util.concurrent.TimeoutException

import scala.concurrent.Await
import scala.concurrent.ExecutionContext
import scala.concurrent.Future
import scala.concurrent.duration._
import scala.util.Failure
import scala.util.Success

import com.typesafe.config.Config

import akka.actor.ActorRef
import akka.actor.ActorSystem
import akka.event.Logging
import scala.concurrent.Await
import scala.concurrent.Future
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import java.util.concurrent.TimeoutException
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport
import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives._
import akka.stream.Materializer
import au.csiro.data61.magda.client.AuthApiClient
import au.csiro.data61.magda.directives.AuthDirectives.requireIsAdmin
import au.csiro.data61.magda.model.Registry._
import gnieh.diffson.sprayJson._
import io.swagger.annotations._
import javax.ws.rs.Path
import scalikejdbc.DB

@Path("/records")
@io.swagger.annotations.Api(value = "records", produces = "application/json")
class RecordsService(config: Config, webHookActor: ActorRef, authClient: AuthApiClient, system: ActorSystem, materializer: Materializer, recordPersistence: RecordPersistence = DefaultRecordPersistence) extends Protocols with SprayJsonSupport {

  val logger = Logging(system, getClass)
  implicit val ec: ExecutionContext = system.dispatcher

  @ApiOperation(value = "Get a list of all records", nickname = "getAll", httpMethod = "GET", response = classOf[Record], responseContainer = "List")
  @ApiImplicitParams(Array(
    new ApiImplicitParam(name = "aspect", required = false, dataType = "string", paramType = "query", allowMultiple = true, value = "The aspects for which to retrieve data, specified as multiple occurrences of this query parameter.  Only records that have all of these aspects will be included in the response."),
    new ApiImplicitParam(name = "optionalAspect", required = false, dataType = "string", paramType = "query", allowMultiple = true, value = "The optional aspects for which to retrieve data, specified as multiple occurrences of this query parameter.  These aspects will be included in a record if available, but a record will be included even if it is missing these aspects."),
    new ApiImplicitParam(name = "pageToken", required = false, dataType = "string", paramType = "query", value = "A token that identifies the start of a page of results.  This token should not be interpreted as having any meaning, but it can be obtained from a previous page of results."),
    new ApiImplicitParam(name = "start", required = false, dataType = "number", paramType = "query", value = "The index of the first record to retrieve.  When possible, specify pageToken instead as it will result in better performance.  If this parameter and pageToken are both specified, this parameter is interpreted as the index after the pageToken of the first record to retrieve."),
    new ApiImplicitParam(name = "limit", required = false, dataType = "number", paramType = "query", value = "The maximum number of records to receive.  The response will include a token that can be passed as the pageToken parameter to a future request to continue receiving results where this query leaves off."),
    new ApiImplicitParam(name = "dereference", required = false, dataType = "boolean", paramType = "query", value = "true to automatically dereference links to other records; false to leave them as links.  Dereferencing a link means including the record itself where the link would be.  Dereferencing only happens one level deep, regardless of the value of this parameter."),
    new ApiImplicitParam(name = "aspectQuery", required = false, dataType = "string", paramType = "query", allowMultiple = true, value = "Filter the records returned by a value within the aspect JSON. Expressed as 'aspectId.path.to.field:value', url encoded. NOTE: This is an early stage API and may change greatly in the future")))
  def getAll = get {
    pathEnd {
      parameters('aspect.*, 'optionalAspect.*, 'pageToken.?, 'start.as[Int].?, 'limit.as[Int].?, 'dereference.as[Boolean].?, 'aspectQuery.*) {
        (aspects, optionalAspects, pageToken, start, limit, dereference, aspectQueries) =>
          val parsedAspectQueries = aspectQueries.map(AspectQuery.parse)

          complete {
            DB readOnly { session =>
              recordPersistence.getAllWithAspects(session, aspects, optionalAspects, pageToken, start, limit, dereference, parsedAspectQueries)
            }
          }
      }
    }
  }

  @Path("/summary")
  @ApiOperation(value = "Get a list of all records as summaries", nickname = "getAllSummary", httpMethod = "GET", response = classOf[RecordSummary], responseContainer = "List")
  @ApiImplicitParams(Array(
    new ApiImplicitParam(name = "pageToken", required = false, dataType = "string", paramType = "query", value = "A token that identifies the start of a page of results.  This token should not be interpreted as having any meaning, but it can be obtained from a previous page of results."),
    new ApiImplicitParam(name = "start", required = false, dataType = "number", paramType = "query", value = "The index of the first record to retrieve.  When possible, specify pageToken instead as it will result in better performance.  If this parameter and pageToken are both specified, this parameter is interpreted as the index after the pageToken of the first record to retrieve."),
    new ApiImplicitParam(name = "limit", required = false, dataType = "number", paramType = "query", value = "The maximum number of records to receive.  The response will include a token that can be passed as the pageToken parameter to a future request to continue receiving results where this query leaves off.")))
  def getAllSummary = get {
    path("summary") {
      parameters('pageToken.?, 'start.as[Int].?, 'limit.as[Int].?) { (pageToken, start, limit) =>
        complete {
          DB readOnly { session =>
            recordPersistence.getAll(session, pageToken, start, limit)
          }
        }
      }
    }
  }

  @ApiOperation(value = "Create a new record", nickname = "create", httpMethod = "POST", response = classOf[Record])
  @ApiImplicitParams(Array(
    new ApiImplicitParam(name = "record", required = true, dataType = "au.csiro.data61.magda.model.Registry$Record", paramType = "body", value = "The definition of the new record."),
    new ApiImplicitParam(name = "X-Magda-Session", required = true, dataType = "String", paramType = "header", value = "Magda internal session id")))
  @ApiResponses(Array(
    new ApiResponse(code = 400, message = "A record already exists with the supplied ID, or the record includes an aspect that does not exist.", response = classOf[BadRequest])))
  def create = post {
    requireIsAdmin(authClient)(system, config) { _ =>
      pathEnd {
        entity(as[Record]) { record =>
          val result = DB localTx { session =>
            recordPersistence.createRecord(session, record) match {
              case Success(result)    => complete(result)
              case Failure(exception) => complete(StatusCodes.BadRequest, BadRequest(exception.getMessage))
            }
          }
          webHookActor ! WebHookActor.Process(false, Some(record.aspects.map(_._1).toList))
          result
        }
      }
    }
  }

  @Path("/pagetokens")
  @ApiOperation(value = "Get a list tokens for paging through the records", nickname = "getPageTokens", httpMethod = "GET", response = classOf[String], responseContainer = "List")
  @ApiImplicitParams(Array(
    new ApiImplicitParam(name = "aspect", required = false, dataType = "string", paramType = "query", allowMultiple = true, value = "The aspects for which to retrieve data, specified as multiple occurrences of this query parameter.  Only records that have all of these aspects will be included in the response."),
    new ApiImplicitParam(name = "limit", required = false, dataType = "number", paramType = "query", value = "The size of each page to get tokens for.")))
  def getPageTokens = get {
    path("pagetokens") {
      pathEnd {
        parameters('aspect.*, 'limit.as[Int].?) { (aspect, limit) =>
          complete {
            DB readOnly { session =>
              "0" :: recordPersistence.getPageTokens(session, aspect, limit)
            }
          }
        }
      }
    }
  }

  @Path("/{recordId}")
  @ApiOperation(value = "Delete a record", nickname = "deleteById", httpMethod = "DELETE", response = classOf[DeleteResult])
  @ApiImplicitParams(Array(
    new ApiImplicitParam(name = "recordId", required = true, dataType = "string", paramType = "path", value = "ID of the record to delete."),
    new ApiImplicitParam(name = "X-Magda-Session", required = true, dataType = "String", paramType = "header", value = "Magda internal session id")))
  @ApiResponses(Array(
    new ApiResponse(code = 400, message = "The record could not be deleted, possibly because it is used by another record.", response = classOf[BadRequest])))
  def deleteById = delete {
    path(Segment) { (recordId: String) =>
      requireIsAdmin(authClient)(system, config) { _ =>
        {
          val result = DB localTx { session =>
            recordPersistence.deleteRecord(session, recordId) match {
              case Success(result)    => complete(DeleteResult(result))
              case Failure(exception) => complete(StatusCodes.BadRequest, BadRequest(exception.getMessage))
            }
          }
          webHookActor ! WebHookActor.Process()
          result
        }
      }
    }
  }

  @Path("/")
  @ApiOperation(value = "Trim by source tag", notes = "Trims records with the provided source that DON'T have the supplied source tag",
    nickname = "trimBySourceTag", httpMethod = "DELETE", response = classOf[MultipleDeleteResult])
  @ApiImplicitParams(Array(
    new ApiImplicitParam(name = "sourceTagToPreserve", required = true, dataType = "string", paramType = "query", value = "Source tag of the records to PRESERVE."),
    new ApiImplicitParam(name = "sourceId", required = true, dataType = "string", paramType = "query", value = "Source id of the records to delete."),
    new ApiImplicitParam(name = "X-Magda-Session", required = true, dataType = "String", paramType = "header", value = "Magda internal session id")))
  @ApiResponses(Array(
    new ApiResponse(code = 202, message = "Deletion is taking a long time (normal for sources with many records) but it has worked"),
    new ApiResponse(code = 400, message = "The records could not be deleted, possibly because they are used by other records.", response = classOf[BadRequest])))
  def trimBySourceTag = delete {
    pathEnd {
      requireIsAdmin(authClient)(system, config) { _ =>
        parameters('sourceTagToPreserve, 'sourceId) { (sourceTagToPreserve, sourceId) =>
          val result = DB localTx { implicit session =>
            val deleteFuture = Future {
              recordPersistence.trimRecordsBySource(sourceTagToPreserve, sourceId)
            } map { result =>
              webHookActor ! WebHookActor.Process()
              result
            }

            val deleteResult = try {
              Await.result(deleteFuture, config.getLong("trimBySourceTagTimeoutThreshold") milliseconds)
            } catch {
              case e: Throwable => Failure(e)
            }

            deleteResult match {
              case Success(result)                             => complete(MultipleDeleteResult(result))
              case Failure(timeoutException: TimeoutException) => complete(StatusCodes.Accepted)
              case Failure(exception) =>
                complete(StatusCodes.BadRequest, BadRequest(exception.getMessage))
            }
          }
          result
        }
      }
    }
  }

  @Path("/{id}")
  @ApiOperation(value = "Get a record by ID", nickname = "getById", httpMethod = "GET", response = classOf[Record],
    notes = "Gets a complete record, including data for all aspects.")
  @ApiImplicitParams(Array(
    new ApiImplicitParam(name = "id", required = true, dataType = "string", paramType = "path", value = "ID of the record to be fetched."),
    new ApiImplicitParam(name = "aspect", required = false, dataType = "string", paramType = "query", allowMultiple = true, value = "The aspects for which to retrieve data, specified as multiple occurrences of this query parameter.  Only records that have all of these aspects will be included in the response."),
    new ApiImplicitParam(name = "optionalAspect", required = false, dataType = "string", paramType = "query", allowMultiple = true, value = "The optional aspects for which to retrieve data, specified as multiple occurrences of this query parameter.  These aspects will be included in a record if available, but a record will be included even if it is missing these aspects."),
    new ApiImplicitParam(name = "dereference", required = false, dataType = "boolean", paramType = "query", value = "true to automatically dereference links to other records; false to leave them as links.  Dereferencing a link means including the record itself where the link would be.  Dereferencing only happens one level deep, regardless of the value of this parameter.")))
  @ApiResponses(Array(
    new ApiResponse(code = 404, message = "No record exists with that ID.", response = classOf[BadRequest])))
  def getById = get {
    path(Segment) { id =>
      parameters('aspect.*, 'optionalAspect.*, 'dereference.as[Boolean].?) { (aspects, optionalAspects, dereference) =>
        DB readOnly { session =>
          recordPersistence.getByIdWithAspects(session, id, aspects, optionalAspects, dereference) match {
            case Some(record) => complete(record)
            case None         => complete(StatusCodes.NotFound, BadRequest("No record exists with that ID or it does not have the required aspects."))
          }
        }
      }
    }
  }

  @Path("/summary/{id}")
  @ApiOperation(value = "Get a summary record by ID", nickname = "getByIdSummary", httpMethod = "GET", response = classOf[RecordSummary],
    notes = "Gets a summary record, including all the aspect ids for which this record has data.")
  @ApiImplicitParams(Array(
    new ApiImplicitParam(name = "id", required = true, dataType = "string", paramType = "path", value = "ID of the record to be fetched.")))
  @ApiResponses(Array(
    new ApiResponse(code = 404, message = "No record exists with that ID.", response = classOf[BadRequest])))
  def getByIdSummary = get {
    path("summary" / Segment) { id =>
      {
        DB readOnly { session =>
          recordPersistence.getById(session, id) match {
            case Some(record) => complete(record)
            case None         => complete(StatusCodes.NotFound, BadRequest("No record exists with that ID."))
          }
        }
      }
    }
  }

  @Path("/{id}")
  @ApiOperation(value = "Modify a record by ID", nickname = "putById", httpMethod = "PUT", response = classOf[Record],
    notes = "Modifies a record.  Aspects included in the request are created or updated, but missing aspects are not removed.")
  @ApiImplicitParams(Array(
    new ApiImplicitParam(name = "id", required = true, dataType = "string", paramType = "path", value = "ID of the record to be fetched."),
    new ApiImplicitParam(name = "record", required = true, dataType = "au.csiro.data61.magda.model.Registry$Record", paramType = "body", value = "The record to save."),
    new ApiImplicitParam(name = "X-Magda-Session", required = true, dataType = "String", paramType = "header", value = "Magda internal session id")))
  def putById = put {
    path(Segment) { (id: String) =>
      requireIsAdmin(authClient)(system, config) { _ =>
        {
          entity(as[Record]) { record =>
            val result = DB localTx { session =>
              recordPersistence.putRecordById(session, id, record) match {
                case Success(aspect) =>
                  complete(record)
                case Failure(exception) => complete(StatusCodes.BadRequest, BadRequest(exception.getMessage))
              }
            }
            webHookActor ! WebHookActor.Process(false, Some(record.aspects.map(_._1).toList))
            result
          }
        }
      }
    }
  }

  @Path("/{id}")
  @ApiOperation(value = "Modify a record by applying a JSON Patch", nickname = "patchById", httpMethod = "PATCH", response = classOf[AspectDefinition],
    notes = "The patch should follow IETF RFC 6902 (https://tools.ietf.org/html/rfc6902).")
  @ApiImplicitParams(Array(
    new ApiImplicitParam(name = "id", required = true, dataType = "string", paramType = "path", value = "ID of the aspect to be saved."),
    new ApiImplicitParam(name = "recordPatch", required = true, dataType = "gnieh.diffson.JsonPatchSupport$JsonPatch", paramType = "body", value = "The RFC 6902 patch to apply to the aspect."),
    new ApiImplicitParam(name = "X-Magda-Session", required = true, dataType = "String", paramType = "header", value = "Magda internal session id")))
  def patchById = patch {
    path(Segment) { (id: String) =>
      requireIsAdmin(authClient)(system, config) { _ =>
        {
          entity(as[JsonPatch]) { recordPatch =>
            val result = DB localTx { session =>
              recordPersistence.patchRecordById(session, id, recordPatch) match {
                case Success(result) =>
                  complete(result)
                case Failure(exception) =>
                  logger.error(exception, "Exception encountered while PATCHing record {} with {}", id, recordPatch.toJson.prettyPrint)
                  complete(StatusCodes.BadRequest, BadRequest(exception.getMessage))
              }
            }
            webHookActor ! WebHookActor.Process(false, Some(List(id)))
            result
          }
        }
      }
    }
  }

  val route =
    getAll ~
      getAllSummary ~
      getPageTokens ~
      getById ~
      getByIdSummary ~
      putById ~
      patchById ~
      trimBySourceTag ~
      deleteById ~
      create ~
      new RecordAspectsService(webHookActor, authClient, system, materializer, config).route ~
      new RecordHistoryService(system, materializer).route

}
